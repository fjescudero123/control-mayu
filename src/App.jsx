import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard, FolderKanban, CheckSquare, AlertCircle,
  CheckCircle2, XCircle, ShieldCheck, LogOut, Trash2, Key, Loader,
  CalendarDays, Briefcase
} from 'lucide-react';

// --- INYECCIÓN AUTOMÁTICA DE ESTILOS (TAILWIND CDN) ---
if (typeof document !== 'undefined' && !document.getElementById('tailwind-cdn')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn';
  script.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(script);
}

// --- FIREBASE ---
import { getFbAuth, getFbDb, getFbStorage, signInAnonymously, onAuthStateChanged } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// --- IMPORTS EXTRAÍDOS ---
import { APPROVERS } from './constants/approvers';
import { MOCK_USERS } from './auth/users';
import { MAKE_WEBHOOK_URL } from './constants/webhooks';
import { useFirestoreCollection } from './hooks/useFirestoreCollection';
import MayuLogo from './components/ui/MayuLogo';
import LoginScreen from './components/shared/LoginScreen';
import DashboardProjectsView from './views/DashboardProjectsView';
import GanttView from './views/GanttView';
import ApprovalsView from './views/ApprovalsView';
import ProjectDetailView from './views/ProjectDetailView';

// --- APLICACIÓN PRINCIPAL ---

export default function MayuApp() {
  const [fbUser, setFbUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [isCreatingProject, setIsCreatingProject] = useState(false); 
  const [firebaseError, setFirebaseError] = useState('');
  
  const [usersDb, setUsersDb] = useState({});
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showOverdueModal, setShowOverdueModal] = useState(null); // ESTADO PARA EL MODAL DE ATRASOS
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '', error: '', success: '' });

  const role = currentUser?.role || '';
  const [view, setView] = useState('dashboard');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [editingDeadline, setEditingDeadline] = useState(null); 
  const [chatMessage, setChatMessage] = useState(''); 
  
  // projects is declared below via useFirestoreCollection + useMemo; init refs
  // with empty values (useEffects below sync them once the sources are defined).
  const projectsRef = useRef([]);
  const usersRef = useRef({});

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: '', client: '', type: 'pods', startDate: '',
    commercialLead: 'Subgerente Comercial', technicalLead: 'Gerente de I+D y Producción',
    operationalLead: 'Gerente de Operaciones', budget: '', margin: '', crmId: null
  });

  useEffect(() => { usersRef.current = usersDb; }, [usersDb]);
  // projectsRef sync moved below where `projects` is defined (TDZ fix).

  // 1. Firebase Auth Initializer
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(getFbAuth());
      } catch (err) {
        console.error("Error autenticando con Firebase:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(getFbAuth(), (user) => {
      setFbUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Hoisted out of the former all-in-one fetch useEffect so it can be passed
  // as `onError` to useFirestoreCollection and also referenced by the chk_users
  // listener below.
  const handleFbError = (error) => {
    console.error(error);
    if (error.message?.includes('permissions') || error.code === 'permission-denied') {
      setFirebaseError('⚠️ Acceso denegado a Firebase. Es muy probable que tus Reglas de Seguridad de Firestore hayan expirado (el límite por defecto son 30 días). Ve a la consola de Firebase -> Firestore Database -> Rules, y actualízalas a "allow read, write: if true;".');
    }
  };

  // chk_projects — real-time via hook. Caller sorts by id desc in useMemo
  // (hook is minimalist by design; sort is presentation concern).
  const { data: projectsRaw, error: projectsError } = useFirestoreCollection('chk_projects', {
    transform: d => d.data(),
    enabled: !!fbUser,
    onError: handleFbError,
  });
  const projects = useMemo(
    () => [...projectsRaw].sort((a, b) => (b.id || '').localeCompare(a.id || '')),
    [projectsRaw],
  );

  // Keep projectsRef in sync with projects (used by the cron job and handlers).
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // Preserve pre-hook behavior: clear firebaseError banner whenever chk_projects
  // snapshot succeeds (original L111 did this inline inside the listener).
  useEffect(() => {
    if (!fbUser) return;
    if (projectsError) return;
    setFirebaseError('');
  }, [projectsRaw, projectsError, fbUser]);

  // crmProjects — real-time via hook (default V1 transform, was V0 — cosmetic).
  const { data: crmProjects } = useFirestoreCollection('projects', {
    enabled: !!fbUser,
    onError: handleFbError,
  });

  // chk_users stays inline — V5 pattern (auto-seed MOCK_USERS when empty,
  // phone-sync side effects, map-keyed return shape). Per HANDOFF decision 36,
  // not migrated to the hook.
  useEffect(() => {
    if (!fbUser) return;
    const usersColRef = collection(getFbDb(),'chk_users');

    const unsubsUsers = onSnapshot(usersColRef, (snapshot) => {
      if (snapshot.empty) {
        Object.entries(MOCK_USERS).forEach(([id, u]) => {
          setDoc(doc(usersColRef, id), u).catch(err => {
            if(err.code === 'permission-denied') handleFbError(err);
          });
        });
      } else {
        const loadedUsers = {};
        snapshot.docs.forEach(d => {
          let userData = d.data();

          if (MOCK_USERS[d.id] && MOCK_USERS[d.id].phone !== '+56900000000') {
             if (userData.phone !== MOCK_USERS[d.id].phone) {
                 userData.phone = MOCK_USERS[d.id].phone;
                 setDoc(doc(usersColRef, d.id), userData).catch(err => {
                   if(err.code === 'permission-denied') handleFbError(err);
                 });
             }
          }

          loadedUsers[d.id] = userData;
        });
        setUsersDb(loadedUsers);
        setIsDataLoaded(true);
      }
    }, handleFbError);

    return () => unsubsUsers();
  }, [fbUser]);

  // --- FUNCIÓN DE ENVÍO DE WHATSAPP DIRECTO A MAKE.COM ---
  const sendWhatsAppNotification = async (targetRoles, subject, textBody) => {
    try {
      const uDb = usersRef.current;
      let phones = [];

      // 1. Extraer teléfonos de los roles (IGNORANDO LOS FALSOS 0000)
      Object.values(uDb).forEach(u => {
        if (targetRoles.includes(u.role) && u.phone && u.phone.trim() !== '' && !u.phone.includes('00000000')) {
          phones.push(u.phone);
        }
      });

      // 2. Extraer IDs de grupos directamente
      targetRoles.forEach(roleOrId => {
        if (roleOrId.includes('@g.us')) {
          phones.push(roleOrId);
        }
      });

      // Quitar duplicados por seguridad
      phones = [...new Set(phones)];

      console.log("Teléfonos recolectados post-filtro:", phones);

      if (phones.length === 0) {
         console.warn("ALERTA: Se canceló el Webhook porque no hay teléfonos reales configurados para el envío.");
         return;
      }

      const fullMessage = `*MAYU PLATAFORMA*\n\n*${subject}*\n\n${textBody}\n\n👉 https://control-mayu.netlify.app/\n_Mensaje automático_`;
      // MAKE_WEBHOOK_URL imported from constants/webhooks

      for (const phone of phones) {
        // LIMPIEZA INTELIGENTE
        const cleanPhone = phone.includes('@g.us') ? phone.replace(/\s+/g, '') : phone.replace(/\D/g, '');

        await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cleanPhone,
            message: fullMessage
          })
        });
      }
    } catch (error) {
      console.error("Error al enviar WhatsApp vía Webhook:", error);
    }
  };

  // --- CRON JOB FRONTEND ---
  useEffect(() => {
    if (!isDataLoaded || !currentUser) return;
    
    // 1. Ampliamos los roles que "despiertan" al robot para incluir al Gerente General
    if (!['Administrador del sistema', 'Project Manager', 'Gerente General'].includes(currentUser.role)) return;

    const checkReminders = async () => {
      const currentProjects = projectsRef.current;
      const now = new Date();
      let updatesMade = false;
      const updatedProjects = JSON.parse(JSON.stringify(currentProjects)); 

      for (let i = 0; i < updatedProjects.length; i++) {
        let projChanged = false;
        const p = updatedProjects[i];

        if (!p.areas) continue;

        Object.keys(p.areas).forEach(areaKey => {
          p.areas[areaKey].docs.forEach(docItem => {
            
            if (docItem.status === 'En revisión' && docItem.reviewStartDate) {
              const startDate = new Date(docItem.reviewStartDate);
              const hoursSinceStart = (now - startDate) / (1000 * 60 * 60);

              if (hoursSinceStart >= 72) {
                const lastReminder = docItem.lastReminderSentAt ? new Date(docItem.lastReminderSentAt) : null;
                const hoursSinceLastReminder = lastReminder ? (now - lastReminder) / (1000 * 60 * 60) : 999;

                if (!lastReminder || hoursSinceLastReminder >= 24) {
                  const requiredRoles = APPROVERS[areaKey.toUpperCase()] || [];
                  const pendingRoles = requiredRoles.filter(r => docItem.approvals[r] !== 'Aprobado' && docItem.approvals[r] !== 'Aprobado con obs.');

                  if (pendingRoles.length > 0) {
                    sendWhatsAppNotification(
                      pendingRoles,
                      `🔴 ALERTA URGENTE: Aprobación Atrasada`,
                      `El documento *${docItem.name}* del proyecto *${p.name}* lleva más de 72 horas esperando tu revisión obligatoria.\n\nEsto está bloqueando el avance del proyecto. Por favor gestiónalo de inmediato.\n\n_Este recordatorio se repetirá cada 24 horas._`
                    );
                    docItem.lastReminderSentAt = now.toISOString();
                    projChanged = true;
                  }
                }
              }
            }

            // 2. El robot ahora dispara alertas si el documento está Pendiente, Observado o Rechazado
            if (['Pendiente', 'Observado', 'Rechazado'].includes(docItem.status) && docItem.deadline) {
              const [year, month, day] = docItem.deadline.split('-');
              const dDate = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
              
              if (now > dDate) {
                const lastDeadlineReminder = docItem.lastDeadlineReminderSentAt ? new Date(docItem.lastDeadlineReminderSentAt) : null;
                const hoursSinceLastDeadlineReminder = lastDeadlineReminder ? (now - lastDeadlineReminder) / (1000 * 60 * 60) : 999;
                
                if (!lastDeadlineReminder || hoursSinceLastDeadlineReminder >= 24) {
                  const targetRoles = [docItem.uploaderRole, 'Subgerente Comercial', '120363405205015820@g.us']; 
                  const uniqueRoles = [...new Set(targetRoles)];
                  
                  sendWhatsAppNotification(
                    uniqueRoles,
                    `⚠️ ALERTA: FECHA LÍMITE VENCIDA`,
                    `El documento *${docItem.name}* del proyecto *${p.name}* tenía como fecha límite el ${docItem.deadline.split('-').reverse().join('-')}.\n\nEl documento se encuentra actualmente *${docItem.status}* y requiere tu acción inmediata en la plataforma.\n\n_Este recordatorio se repetirá cada 24 horas hasta que se solucione._`
                  );
                  docItem.lastDeadlineReminderSentAt = now.toISOString();
                  projChanged = true;
                }
              }
            }
          });
        });

        if (projChanged) {
          await setDoc(doc(getFbDb(),'chk_projects', p.id), p);
          updatesMade = true;
        }
      }
    };

    const initialTimer = setTimeout(checkReminders, 5000);
    const interval = setInterval(checkReminders, 3600000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isDataLoaded, currentUser]);

  const recalculateProjectStatus = (proj) => {
    let allProjectApproved = true;
    let anyProjectObserved = false;
    let projectHasProgress = false;

    const updatedAreas = { ...proj.areas };

    Object.keys(updatedAreas).forEach(areaKey => {
      const area = updatedAreas[areaKey];
      const totalDocs = area.docs.length;
      const approvedDocs = area.docs.filter(d => d.status === 'Aprobado' || d.status === 'Aprobado con observaciones').length;
      const observedDocs = area.docs.filter(d => ['Observado', 'Rechazado'].includes(d.status)).length;
      const pendingDocs = area.docs.filter(d => d.status === 'Pendiente').length;

      if (approvedDocs === totalDocs) area.status = 'Aprobada';
      else if (observedDocs > 0) area.status = 'Con observaciones';
      else if (pendingDocs === totalDocs) area.status = 'No iniciada';
      else area.status = 'En proceso';

      if (area.status !== 'Aprobada') allProjectApproved = false;
      if (area.status === 'Con observaciones') anyProjectObserved = true;
      if (area.status !== 'No iniciada') projectHasProgress = true;
    });

    let newProjectStatus = proj.status;
    if (allProjectApproved) newProjectStatus = 'Aprobado para ejecución';
    else if (anyProjectObserved) newProjectStatus = 'Observado';
    else if (projectHasProgress) newProjectStatus = 'En preparación para ejecución';

    return { ...proj, areas: updatedAreas, status: newProjectStatus };
  };

  const handleSimulateAction = async (projectId, areaKey, docId, action, comment = '') => {
    const p = projects.find(proj => proj.id === projectId);
    if (!p) return;

    const newAreas = { ...p.areas };
    const docIndex = newAreas[areaKey].docs.findIndex(d => d.id === docId);
    const document = { ...newAreas[areaKey].docs[docIndex] };
    
    const now = new Date();
    const nowString = now.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    
    if (action === 'UPLOAD') {
      const newVersion = document.version === '-' ? 1 : parseInt(document.version.replace('V','')) + 1;
      document.version = `V${newVersion}`;
      document.status = 'En revisión';
      document.approvals = {}; 
      document.reviewStartDate = now.toISOString(); 
      document.lastReminderSentAt = null;
      document.lastDeadlineReminderSentAt = null; 
      document.history = [{date: nowString, user: currentUser.name, action: `Cargó ${document.version}`}, ...document.history];
      
      const requiredRoles = APPROVERS[areaKey.toUpperCase()] || [];
      sendWhatsAppNotification(
        requiredRoles,
        `NUEVO DOCUMENTO PARA REVISIÓN`,
        `Se ha generado la versión ${document.version} del entregable *${document.name}* para el proyecto *${p.name}*.\n\nPor favor ingresa a la plataforma para revisarlo y firmarlo.`
      );
    } 
    else if (action === 'DELETE_FILE') {
      if (document.fileUrl) {
        try {
          const fileRef = ref(getFbStorage(),document.fileUrl);
          await deleteObject(fileRef);
        } catch (error) {
          console.error("Error eliminando archivo físico:", error);
        }
      }
      
      document.status = 'Pendiente';
      document.approvals = {};
      document.fileUrl = null;
      document.originalFileName = null;
      document.reviewStartDate = null; 
      document.lastReminderSentAt = null;
      document.history = [{date: nowString, user: currentUser.name, action: `Eliminó el archivo anterior para permitir subir nueva versión.`}, ...document.history];
    }
    else if (['APPROVE', 'APPROVE_WITH_OBS', 'REJECT', 'OBSERVE'].includes(action)) {
      
      let actionStatus = 'Observado';
      if (action === 'APPROVE') actionStatus = 'Aprobado';
      if (action === 'APPROVE_WITH_OBS') actionStatus = 'Aprobado con obs.';
      if (action === 'REJECT') actionStatus = 'Rechazado';

      document.approvals = { ...document.approvals, [role]: actionStatus };

      if (action === 'APPROVE_WITH_OBS') {
        sendWhatsAppNotification(
          [document.uploaderRole],
          `📝 APROBACIÓN CON OBSERVACIONES`,
          `*${currentUser.name}* ha aprobado con observaciones el documento *${document.name}* (Versión ${document.version}) del proyecto *${p.name}*.\n\n*Comentario:* "${comment}"\n\nPor favor, ingresa a la plataforma para revisar los detalles.`
        );
      } else if (action === 'OBSERVE' || action === 'REJECT') {
        const accionTexto = action === 'OBSERVE' ? 'dejado una observación en' : 'rechazado';
        sendWhatsAppNotification(
          [document.uploaderRole],
          `⚠️ DOCUMENTO ${action === 'OBSERVE' ? 'OBSERVADO' : 'RECHAZADO'}`,
          `*${currentUser.name}* ha ${accionTexto} el documento *${document.name}* (Versión ${document.version}) del proyecto *${p.name}*.\n\n*Comentario:* "${comment}"\n\nPor favor, corrige el documento y sube una nueva versión.`
        );
      }
      
      const requiredApprovers = APPROVERS[areaKey.toUpperCase()];
      const allApproved = requiredApprovers.every(appr => document.approvals[appr] === 'Aprobado' || document.approvals[appr] === 'Aprobado con obs.');
      const anyRejected = Object.values(document.approvals).includes('Rechazado') || Object.values(document.approvals).includes('Observado');
      
      if (allApproved) {
        const hasObs = requiredApprovers.some(appr => document.approvals[appr] === 'Aprobado con obs.');
        document.status = hasObs ? 'Aprobado con observaciones' : 'Aprobado';
        document.reviewStartDate = null; 
        sendWhatsAppNotification(
          [document.uploaderRole, 'Project Manager', 'Administrador del sistema'],
          `✅ DOCUMENTO APROBADO`,
          `El documento *${document.name}* (Versión ${document.version}) del proyecto *${p.name}* ha recibido todas las firmas requeridas y está oficialmente Aprobado.`
        );
      }
      else if (anyRejected) document.status = 'Observado';
      else document.status = 'En revisión';

      let actionText = 'Observó';
      if (action === 'APPROVE') actionText = 'Aprobó';
      if (action === 'APPROVE_WITH_OBS') actionText = 'Aprobó con observaciones';
      if (action === 'REJECT') actionText = 'Rechazó';

      const logText = comment ? `${actionText}. Comentario: "${comment}"` : actionText;
      document.history = [{date: nowString, user: currentUser.name, action: logText}, ...document.history];
    }

    newAreas[areaKey].docs[docIndex] = document;
    
    let updatedProject = { ...p, areas: newAreas };
    updatedProject = recalculateProjectStatus(updatedProject);
    
    await setDoc(doc(getFbDb(),'chk_projects', updatedProject.id), updatedProject);
    
    setSelectedDoc(null);
    setCommentText('');
    if (selectedProject?.id === projectId) setSelectedProject(updatedProject);
  };

  const handleFileUpload = async (projectId, areaKey, docId, file) => {
    if (!file) return;
    
    setUploadingDocs(prev => ({ ...prev, [docId]: true }));
    
    try {
      const fileExtension = file.name.split('.').pop();
      const storageRef = ref(getFbStorage(),`chk_projects/${projectId}/${areaKey}/${docId}_${Date.now()}.${fileExtension}`);
      
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const p = projects.find(proj => proj.id === projectId);
      if (!p) return;

      const newAreas = { ...p.areas };
      const docIndex = newAreas[areaKey].docs.findIndex(d => d.id === docId);
      const document = { ...newAreas[areaKey].docs[docIndex] };
      
      const now = new Date();
      const nowString = now.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
      const newVersion = document.version === '-' ? 1 : parseInt(document.version.replace('V','')) + 1;
      
      document.version = `V${newVersion}`;
      document.status = 'En revisión';
      document.approvals = {}; 
      document.fileUrl = downloadUrl;
      document.originalFileName = file.name;
      document.reviewStartDate = now.toISOString(); 
      document.lastReminderSentAt = null;
      document.lastDeadlineReminderSentAt = null; 
      document.history = [{date: nowString, user: currentUser.name, action: `Cargó ${document.version} (${file.name})`}, ...document.history];
      
      newAreas[areaKey].docs[docIndex] = document;
      let updatedProject = { ...p, areas: newAreas };
      updatedProject = recalculateProjectStatus(updatedProject);
      
      await setDoc(doc(getFbDb(),'chk_projects', updatedProject.id), updatedProject);
      
      if (selectedProject?.id === projectId) setSelectedProject(updatedProject);

      const requiredRoles = APPROVERS[areaKey.toUpperCase()] || [];
      sendWhatsAppNotification(
        requiredRoles,
        `NUEVO ARCHIVO PARA REVISIÓN`,
        `Se ha subido un archivo físico (Versión ${document.version}) para el entregable *${document.name}* del proyecto *${p.name}*.\n\nPor favor ingresa a la plataforma para revisarlo y firmarlo.`
      );

    } catch (error) {
      console.error("Error subiendo archivo:", error);
      alert("Error al subir el archivo. Verifica las reglas de Storage en Firebase.");
    } finally {
      setUploadingDocs(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handleSaveDeadline = async (projectId, areaKey, docId, newDate) => {
    const p = projects.find(proj => proj.id === projectId);
    if (!p) return;

    const newAreas = { ...p.areas };
    const docIndex = newAreas[areaKey].docs.findIndex(d => d.id === docId);
    const document = { ...newAreas[areaKey].docs[docIndex] };

    if (document.deadline === newDate || (!document.deadline && !newDate)) {
      setEditingDeadline(null);
      return;
    }

    const currentV = document.deadlineVersion || 0;
    const newV = currentV + 1;

    document.deadline = newDate;
    document.deadlineVersion = newV;
    document.lastDeadlineReminderSentAt = null; 

    const formattedDate = newDate ? newDate.split('-').reverse().join('-') : 'Ninguna';
    const nowString = new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    
    document.history = [
      {date: nowString, user: currentUser.name, action: `Fijó fecha límite a ${formattedDate} (V${newV})`}, 
      ...document.history
    ];

    newAreas[areaKey].docs[docIndex] = document;
    let updatedProject = { ...p, areas: newAreas };

    await setDoc(doc(getFbDb(),'chk_projects', updatedProject.id), updatedProject);

    setEditingDeadline(null);
    if (selectedProject?.id === projectId) setSelectedProject(updatedProject);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !selectedDoc) return;

    const p = projects.find(proj => proj.id === selectedDoc.projectId);
    if (!p) return;

    const newAreas = { ...p.areas };
    const docIndex = newAreas[selectedDoc.areaKey].docs.findIndex(d => d.id === selectedDoc.doc.id);
    const document = { ...newAreas[selectedDoc.areaKey].docs[docIndex] };

    const newMessage = {
      id: Date.now().toString(),
      text: chatMessage.trim(),
      user: currentUser.name,
      timestamp: new Date().toISOString()
    };

    document.messages = [...(document.messages || []), newMessage];
    newAreas[selectedDoc.areaKey].docs[docIndex] = document;

    let updatedProject = { ...p, areas: newAreas };
    await setDoc(doc(getFbDb(),'chk_projects', updatedProject.id), updatedProject);

    setChatMessage('');
    setSelectedDoc({ ...selectedDoc, doc: document });
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    await deleteDoc(doc(getFbDb(),'chk_projects', projectToDelete.id));
    if (selectedProject?.id === projectToDelete.id) {
      setView('projects');
      setSelectedProject(null);
    }
    setProjectToDelete(null);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (isCreatingProject) return; 
    
    setIsCreatingProject(true);
    
    try {
      const currentYear = new Date().getFullYear();
      let maxNumber = 0;
      
      projectsRef.current.forEach(p => {
        if (p.id.startsWith(`PRJ-${currentYear}-`)) {
          const num = parseInt(p.id.split('-')[2], 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      });
      
      let nextNum = maxNumber + 1;
      let newId = `PRJ-${currentYear}-${String(nextNum).padStart(3, '0')}`;
      
      while (projectsRef.current.some(p => p.id === newId)) {
        nextNum++;
        newId = `PRJ-${currentYear}-${String(nextNum).padStart(3, '0')}`;
      }

      const createDoc = (id, name, role) => ({
        id, name, status: 'Pendiente', version: '-', uploaderRole: role, approvals: {}, history: [], deadline: null, deadlineVersion: 0, messages: []
      });

      // --- LOGICA MOMENTUM CHECKLIST ---
      let docsComercial = [
        createDoc('c1', 'Orden de compra o contrato', newProjectForm.commercialLead),
        createDoc('c2', 'Cronograma de entregas', newProjectForm.commercialLead)
      ];

      if (newProjectForm.type.toLowerCase() === 'momentum') {
        docsComercial.push(
          createDoc('c3', 'Carpeta ingreso permiso', newProjectForm.commercialLead),
          createDoc('c4', 'Permiso de edificación', newProjectForm.commercialLead),
          createDoc('c5', 'Ingreso SERVIU', newProjectForm.commercialLead),
          createDoc('c6', 'Planos de terreno', newProjectForm.commercialLead)
        );
      }

      let newProject = {
        id: newId,
        crmId: newProjectForm.crmId || null,
        ...newProjectForm,
        activationDate: new Date().toISOString().split('T')[0],
        status: 'En preparación para ejecución',
        areas: {
          comercial: {
            name: 'Comercial', status: 'No iniciada',
            docs: docsComercial
          },
          ingenieria: {
            name: 'Ingeniería y Producción', status: 'No iniciada',
            docs: [
              createDoc('i1', 'BOM (Bill of Materials)', 'Equipo de Diseño'),
              createDoc('i2', 'Planos de fabricación del proyecto', 'Equipo de Diseño'),
              createDoc('i3', 'Planos de arquitectura', 'Equipo de Diseño'),
              createDoc('i4', 'Carta Gantt de desarrollo', newProjectForm.technicalLead),
              createDoc('i5', 'Carta Gantt de fabricación', 'Jefe de Producción'),
              createDoc('i6', 'Planos de especialidades', 'Equipo de Diseño'),
              createDoc('i7', 'Planos de montaje', 'Equipo de Diseño'),
              createDoc('i8', 'Protocolo de transporte', newProjectForm.technicalLead)
            ]
          },
          operaciones: {
            name: 'Operaciones', status: 'No iniciada',
            docs: [
              createDoc('o1', 'Plan de despachos', newProjectForm.operationalLead),
              createDoc('o2', 'Carta Gantt de compras de materia prima', newProjectForm.operationalLead)
            ]
          },
          finanzas: {
            name: 'Finanzas', status: 'No iniciada',
            docs: [
              createDoc('f1', 'Análisis financiero del proyecto', 'Gerente de Administración y Finanzas')
            ]
          },
          calidad: {
            name: 'Control de Calidad', status: 'No iniciada',
            docs: [
              createDoc('q1', 'Archivo de control de calidad del proyecto', 'Encargado de Calidad')
            ]
          }
        }
      };

      newProject = recalculateProjectStatus(newProject);
      await setDoc(doc(getFbDb(),'chk_projects', newProject.id), newProject);

      setShowNewProjectModal(false);
      setNewProjectForm({ name: '', client: '', type: 'pods', startDate: '', commercialLead: 'Subgerente Comercial', technicalLead: 'Gerente de I+D y Producción', operationalLead: 'Gerente de Operaciones', budget: '', margin: '', crmId: null });
      setSelectedProject(newProject);
      setView('project_detail');
    } catch (error) {
      console.error("Error al crear proyecto:", error);
      alert("Hubo un problema al crear el proyecto. Inténtalo de nuevo.");
    } finally {
      setIsCreatingProject(false); 
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.current !== usersDb[currentUser.id].password) {
      setPasswordForm({...passwordForm, error: 'La contraseña actual es incorrecta', success: ''});
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordForm({...passwordForm, error: 'Las contraseñas nuevas no coinciden', success: ''});
      return;
    }
    
    const updatedUser = { ...usersDb[currentUser.id], password: passwordForm.new };
    await setDoc(doc(getFbDb(),'chk_users', currentUser.id), updatedUser);
    
    setPasswordForm({ current: '', new: '', confirm: '', error: '', success: '¡Contraseña actualizada con éxito!' });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordForm({ current: '', new: '', confirm: '', error: '', success: '' });
    }, 2000);
  };

  // --- CALCULO RENDIMIENTO POR ÁREA ---
  const areaStats = useMemo(() => {
    const stats = {
      comercial: { name: 'Comercial', uploadTimes: [], deadlineChanges: 0, versions: 0, overdueDocsList: [] },
      ingenieria: { name: 'Ingeniería y Producción', uploadTimes: [], deadlineChanges: 0, versions: 0, overdueDocsList: [] },
      operaciones: { name: 'Operaciones', uploadTimes: [], deadlineChanges: 0, versions: 0, overdueDocsList: [] },
      finanzas: { name: 'Finanzas', uploadTimes: [], deadlineChanges: 0, versions: 0, overdueDocsList: [] },
      calidad: { name: 'Control de Calidad', uploadTimes: [], deadlineChanges: 0, versions: 0, overdueDocsList: [] }
    };

    const now = new Date();

    projects.forEach(p => {
      if (!p.activationDate) return;
      const [y, m, d] = p.activationDate.split('-');
      const projStart = new Date(Number(y), Number(m) - 1, Number(d));

      Object.entries(p.areas || {}).forEach(([areaKey, area]) => {
        const st = stats[areaKey.toLowerCase()];
        if (!st) return;

        area.docs.forEach(doc => {
          if (doc.deadlineVersion && doc.deadlineVersion > 1) {
            st.deadlineChanges += (doc.deadlineVersion - 1);
          }
          
          if (doc.version && doc.version !== '-') {
            const vNum = parseInt(doc.version.replace('V', ''));
            if (!isNaN(vNum) && vNum > 1) {
              st.versions += (vNum - 1);
            }
          }

          const uploadEvents = doc.history.filter(h => h.action.includes('Cargó V1'));
          if (uploadEvents.length > 0) {
            const firstUpload = uploadEvents[uploadEvents.length - 1]; 
            try {
              const cleanStr = firstUpload.date.replace(',', '').trim();
              const dateStr = cleanStr.split(' ')[0]; 
              const parts = dateStr.split(/[-/]/);
              if (parts.length === 3) {
                const uploadDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                const diffTime = uploadDate.getTime() - projStart.getTime();
                let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < 0) diffDays = 0; 
                st.uploadTimes.push(diffDays);
              }
            } catch (e) {}
          }

          // 4. Calcular Documentos Atrasados (Pasados de la fecha límite) - CON DETALLE
          if (doc.deadline) {
            const [dy, dm, dd] = doc.deadline.split('-');
            const limitDate = new Date(Number(dy), Number(dm) - 1, Number(dd), 23, 59, 59);
            const isApproved = doc.status === 'Aprobado' || doc.status === 'Aprobado con observaciones';
            
            const overdueInfo = {
              projectName: p.name,
              docName: doc.name,
              version: doc.version,
              deadline: doc.deadline,
              uploaderRole: doc.uploaderRole,
              status: doc.status
            };

            if (!isApproved && now > limitDate) {
              // Atrasado actualmente
              st.overdueDocsList.push(overdueInfo);
            } else if (isApproved) {
              // Verificar en el historial si se aprobó de forma tardía
              const approvalEvent = doc.history.find(h => h.action.includes('Aprobó'));
              if (approvalEvent) {
                try {
                  const cleanStr = approvalEvent.date.replace(',', '').trim();
                  const dateStr = cleanStr.split(' ')[0]; 
                  const parts = dateStr.split(/[-/]/);
                  if (parts.length === 3) {
                    const approvalDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    if (approvalDate > limitDate) {
                      st.overdueDocsList.push(overdueInfo);
                    }
                  }
                } catch (e) {}
              }
            }
          }
        });
      });
    });

    return Object.values(stats).map(s => {
      const avgUpload = s.uploadTimes.length > 0 
        ? Math.round(s.uploadTimes.reduce((a, b) => a + b, 0) / s.uploadTimes.length) 
        : 0;
      return { ...s, avgUpload, overdueDocs: s.overdueDocsList.length };
    });
  }, [projects]);


  // --- CALCULO GANTT CHART ---
  const ganttData = useMemo(() => {
    let globalMin = null;
    let globalMax = null;

    const projectTimelines = projects.map(p => {
      let pMin = null;
      let pMax = null;
      let docsWithDeadlines = 0;

      Object.values(p.areas || {}).forEach(area => {
        area.docs.forEach(doc => {
          if (doc.deadline) {
            docsWithDeadlines++;
            const [year, month, day] = doc.deadline.split('-');
            const dDate = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
            if (!pMin || dDate < pMin) pMin = dDate;
            if (!pMax || dDate > pMax) pMax = dDate;
          }
        });
      });

      if (pMin && pMax) {
        if (pMin === pMax) {
           pMax += 24 * 60 * 60 * 1000; 
        }
        if (!globalMin || pMin < globalMin) globalMin = pMin;
        if (!globalMax || pMax > globalMax) globalMax = pMax;
      }

      return {
        ...p,
        startMs: pMin,
        endMs: pMax,
        hasDeadlines: docsWithDeadlines > 0
      };
    }).filter(p => p.hasDeadlines);

    if (projectTimelines.length === 0 || !globalMin || !globalMax) return null;

    const startTimeline = new Date(globalMin);
    startTimeline.setMonth(startTimeline.getMonth() - 1);
    startTimeline.setDate(1);

    const endTimeline = new Date(globalMax);
    endTimeline.setMonth(endTimeline.getMonth() + 2);
    endTimeline.setDate(0);

    const totalMs = endTimeline.getTime() - startTimeline.getTime();

    let months = [];
    let curr = new Date(startTimeline);
    while (curr <= endTimeline) {
        months.push(new Date(curr));
        curr.setMonth(curr.getMonth() + 1);
    }

    return { startTimeline, endTimeline, totalMs, months, projectTimelines };
  }, [projects]);

  const kpis = useMemo(() => {
    let totalDocs = 0;
    let approvedDocs = 0;
    let totalObs = 0;
    let myPending = 0;

    projects.forEach(p => {
      Object.entries(p.areas || {}).forEach(([areaKey, area]) => {
        area.docs.forEach(doc => {
          totalDocs++;
          if (doc.status === 'Aprobado' || doc.status === 'Aprobado con observaciones') approvedDocs++;
          if (doc.status === 'Observado' || doc.status === 'Rechazado') totalObs++;
          
          if (doc.status === 'En revisión' && APPROVERS[areaKey.toUpperCase()]?.includes(role)) {
            if (doc.approvals[role] !== 'Aprobado' && doc.approvals[role] !== 'Aprobado con obs.') {
              myPending++;
            }
          }
        });
      });
    });

    return {
      progress: totalDocs === 0 ? 0 : Math.round((approvedDocs / totalDocs) * 100),
      observations: totalObs,
      myPendingApprovals: myPending
    };
  }, [projects, role]);

  const handleLogin = (e) => {
    e.preventDefault();
    const user = usersDb[loginForm.username.toLowerCase()];
    if (user && user.password === loginForm.password) {
      setCurrentUser({ id: loginForm.username.toLowerCase(), ...user });
      setLoginError('');
      setLoginForm({ username: '', password: '' });
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('dashboard');
  };

  // --- CTX OBJECT (agrupado por dominio) ---
  const ctx = useMemo(() => ({
    data: { projects, areaStats, ganttData, kpis },
    active: { currentUser, role },
    nav: { view, setView, selectedProject, setSelectedProject, selectedDoc, setSelectedDoc },
    setters: {
      showOverdueModal, setShowOverdueModal,
      setShowNewProjectModal,
      setProjectToDelete,
      editingDeadline, setEditingDeadline,
      commentText, setCommentText,
      chatMessage, setChatMessage,
      uploadingDocs,
    },
    fb: {
      handleSimulateAction,
      handleFileUpload,
      handleSaveDeadline,
      handleSendMessage,
    },
  }), [
    projects, areaStats, ganttData, kpis,
    currentUser, role,
    view, selectedProject, selectedDoc,
    showOverdueModal, editingDeadline, commentText, chatMessage, uploadingDocs,
  ]);

  if (firebaseError) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg text-center border-t-4 border-red-500">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error de Permisos en Base de Datos</h2>
          <p className="text-sm text-slate-600 mb-6">{firebaseError}</p>
          <div className="bg-slate-50 p-4 rounded-lg text-left text-xs font-mono text-slate-700 overflow-x-auto">
            rules_version = '2';<br/>
            service cloud.firestore &#123;<br/>
            &nbsp;&nbsp;match /databases/&#123;database&#125;/documents &#123;<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;match /&#123;document=**&#125; &#123;<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if true;<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&#125;<br/>
            &nbsp;&nbsp;&#125;<br/>
            &#125;
          </div>
        </div>
      </div>
    );
  }

  if (!isDataLoaded) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <ShieldCheck size={40} className="text-[#899264] animate-bounce" />
          <p className="text-[#788A87] font-medium">Sincronizando con la Nube de MAYU...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen loginForm={loginForm} setLoginForm={setLoginForm} loginError={loginError} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9F7] flex flex-col font-sans text-slate-800">
      
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <MayuLogo className="h-8 w-auto" />
          <div className="hidden sm:block border-l-2 border-[#DCA75D] pl-3 ml-1">
            <h1 className="font-bold text-lg leading-tight text-slate-900 tracking-tight">MAYU</h1>
            <p className="text-[10px] text-[#788A87] font-bold tracking-widest uppercase">Pre-Ejecución</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800 leading-tight">{currentUser.name}</p>
            <p className="text-xs text-[#788A87] font-medium">{currentUser.role}</p>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 py-1.5 px-3 rounded-md border border-slate-200 transition-colors"
              title="Cambiar contraseña"
            >
              <Key size={16} className="text-[#DCA75D]" /> <span className="text-sm font-medium hidden sm:inline">Clave</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 py-1.5 px-3 rounded-md border border-slate-200 hover:border-red-200 transition-colors"
            >
              <LogOut size={16} /> <span className="text-sm font-medium hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-2">
          <button onClick={() => {setView('dashboard'); setSelectedProject(null)}} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-[#899264]/10 text-[#899264]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button onClick={() => {setView('projects'); setSelectedProject(null)}} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${view === 'projects' || view === 'project_detail' ? 'bg-[#899264]/10 text-[#899264]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <FolderKanban size={18} /> Proyectos
          </button>
          <button onClick={() => {setView('gantt'); setSelectedProject(null)}} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${view === 'gantt' ? 'bg-[#899264]/10 text-[#899264]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <CalendarDays size={18} /> Carta Gantt
          </button>
          <button onClick={() => {setView('approvals'); setSelectedProject(null)}} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors justify-between ${view === 'approvals' ? 'bg-[#899264]/10 text-[#899264]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-3"><CheckSquare size={18} /> Mis Aprobaciones</div>
            {kpis.myPendingApprovals > 0 && (
              <span className="bg-[#DCA75D] text-white text-xs px-2 py-0.5 rounded-full shadow-sm">{kpis.myPendingApprovals}</span>
            )}
          </button>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          
          {/* VIEW: DASHBOARD & PROJECTS */}
          {(view === 'dashboard' || view === 'projects') && <DashboardProjectsView ctx={ctx} />}


          {/* VIEW: GANTT CHART */}
          {view === 'gantt' && <GanttView ctx={ctx} />}

          {/* VIEW: PROJECT DETAILS */}
          {view === 'project_detail' && selectedProject && <ProjectDetailView ctx={ctx} />}

          {/* VIEW: MY APPROVALS */}
          {view === 'approvals' && <ApprovalsView ctx={ctx} />}

        </main>
      </div>

      {showNewProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up border-t-4 border-t-[#DCA75D]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FolderKanban className="text-[#DCA75D]"/> Activar Nuevo Proyecto
              </h3>
              <button onClick={() => setShowNewProjectModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              
              {/* SECCIÓN IMPORTACIÓN CRM */}
              <div className="col-span-2 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <label className="block text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                   <Briefcase size={16} /> Importar desde CRM (Negocios Cerrados)
                </label>
                <select 
                  value={newProjectForm.crmId || ""}
                  onChange={(e) => {
                    const crmId = e.target.value;
                    if (!crmId) {
                       setNewProjectForm(prev => ({...prev, crmId: null}));
                       return;
                    }
                    const proj = crmProjects.find(p => p.id === crmId);
                    if (proj) {
                       setNewProjectForm({
                          ...newProjectForm,
                          crmId: proj.id,
                          name: proj.nombre || '',
                          client: proj.cliente || '',
                          type: proj.linea_negocio ? proj.linea_negocio.toLowerCase() : 'pods',
                          startDate: proj.fecha_inicio || '',
                          budget: proj.ingreso_proyectado ? proj.ingreso_proyectado.toString() : ''
                       });
                    }
                  }}
                  className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none text-sm bg-white font-medium text-slate-700"
                >
                  <option value="">-- Crear proyecto de forma manual --</option>
                  {crmProjects
                     .filter(p => p.estado_comercial === 'Negocio cerrado')
                     .filter(p => !projects.some(existing => existing.crmId === p.id)) // Ocultar los ya importados
                     .map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} - {p.cliente}</option>
                     ))
                  }
                </select>
                <p className="text-xs text-indigo-600 mt-2">Al seleccionar un proyecto, los datos se autocompletarán.</p>
              </div>

              <form id="newProjectForm" onSubmit={handleCreateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Proyecto</label>
                    <input required type="text" value={newProjectForm.name} onChange={e => setNewProjectForm({...newProjectForm, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none" placeholder="Ej: Pods Larraín Prieto" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                    <input required type="text" value={newProjectForm.client} onChange={e => setNewProjectForm({...newProjectForm, client: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none" placeholder="Ej: Inmobiliaria X" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Proyecto</label>
                    <select value={newProjectForm.type} onChange={e => setNewProjectForm({...newProjectForm, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none bg-white">
                      <option value="pods">Pods</option>
                      <option value="soluciones transitorias">Soluciones transitorias</option>
                      <option value="momentum">Momentum</option>
                      <option value="galpones">Galpones</option>
                      <option value="soluciones a medida">Soluciones a medida</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Est. Inicio</label>
                    <input required type="date" value={newProjectForm.startDate} onChange={e => setNewProjectForm({...newProjectForm, startDate: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Presupuesto ($)</label>
                    <input required type="text" value={newProjectForm.budget} onChange={e => setNewProjectForm({...newProjectForm, budget: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none" placeholder="Ej: 150.000.000" />
                  </div>
                </div>

                <div className="mt-6 mb-2 border-b border-slate-200 pb-2">
                  <h4 className="text-sm font-bold text-slate-800">Responsables Asignados</h4>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Comercial</label>
                    <select value={newProjectForm.commercialLead} onChange={e => setNewProjectForm({...newProjectForm, commercialLead: e.target.value})} className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none bg-slate-50">
                      <option value="Gerente Comercial">Gerente Comercial</option>
                      <option value="Subgerente Comercial">Subgerente Comercial</option>
                      <option value="Project Manager">Project Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Técnico (I+D)</label>
                    <select value={newProjectForm.technicalLead} onChange={e => setNewProjectForm({...newProjectForm, technicalLead: e.target.value})} className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none bg-slate-50">
                      <option value="Gerente de I+D y Producción">Gerente de I+D y Producción</option>
                      <option value="Jefe de Producción">Jefe de Producción</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Operativo</label>
                    <select value={newProjectForm.operationalLead} onChange={e => setNewProjectForm({...newProjectForm, operationalLead: e.target.value})} className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none bg-slate-50">
                      <option value="Gerente de Operaciones">Gerente de Operaciones</option>
                      <option value="Jefe de Logística">Jefe de Logística</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowNewProjectModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button 
                type="submit" 
                form="newProjectForm" 
                disabled={isCreatingProject}
                className={`bg-[#899264] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#788253] transition-colors shadow-sm flex items-center gap-2 ${isCreatingProject ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isCreatingProject ? <Loader className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} 
                {isCreatingProject ? 'Creando...' : 'Crear y Generar Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-slide-up border-t-4 border-t-red-500">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Eliminar Proyecto?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Estás a punto de eliminar el proyecto <strong>{projectToDelete.name}</strong> y toda su trazabilidad. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setProjectToDelete(null)} 
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteProject} 
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-slide-up border-t-4 border-t-[#788A87]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Key className="text-[#DCA75D]" size={20}/> Cambiar Contraseña
              </h3>
              <button onClick={() => {setShowPasswordModal(false); setPasswordForm({ current: '', new: '', confirm: '', error: '', success: '' });}} className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6">
              {passwordForm.error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-center gap-2 border border-red-200">
                  <AlertCircle size={16} /> {passwordForm.error}
                </div>
              )}
              {passwordForm.success && (
                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 flex items-center gap-2 border border-green-200">
                  <CheckCircle2 size={16} /> {passwordForm.success}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Actual</label>
                  <input type="password" required value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Contraseña</label>
                  <input type="password" required value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nueva Contraseña</label>
                  <input type="password" required value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#899264] outline-none" />
                </div>
                <button type="submit" className="w-full bg-[#899264] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#788253] transition-colors shadow-sm mt-2">
                  Actualizar Clave
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseSoft { 0%, 100% { box-shadow: 0 0 0 0 rgba(137, 146, 100, 0.4); } 50% { box-shadow: 0 0 0 4px rgba(137, 146, 100, 0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
        .animate-pulse-soft { animation: pulseSoft 2s infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}