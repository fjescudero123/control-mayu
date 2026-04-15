import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, FolderKanban, CheckSquare, Clock, AlertCircle, 
  CheckCircle2, XCircle, UploadCloud, Eye, History, MessageSquare, 
  ChevronRight, FileText, UserCircle, PlayCircle, ShieldCheck, LogOut, 
  Lock, User, Plus, Trash2, Key, Loader, Edit2, CalendarDays, Send, Briefcase, BarChart3
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
import { ROLES } from './constants/roles';
import { APPROVERS } from './constants/approvers';
import { MOCK_USERS } from './auth/users';
import { MAKE_WEBHOOK_URL } from './constants/webhooks';
import StatusBadge from './components/ui/StatusBadge';
import MayuLogo from './components/ui/MayuLogo';
import LoginScreen from './components/shared/LoginScreen';

// --- APLICACIÓN PRINCIPAL ---

export default function MayuApp() {
  const [fbUser, setFbUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [isCreatingProject, setIsCreatingProject] = useState(false); 
  const [firebaseError, setFirebaseError] = useState('');
  
  const [usersDb, setUsersDb] = useState({});
  const [projects, setProjects] = useState([]);
  const [crmProjects, setCrmProjects] = useState([]); 
  
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
  
  const projectsRef = useRef(projects);
  const usersRef = useRef(usersDb);

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: '', client: '', type: 'pods', startDate: '',
    commercialLead: 'Subgerente Comercial', technicalLead: 'Gerente de I+D y Producción',
    operationalLead: 'Gerente de Operaciones', budget: '', margin: '', crmId: null
  });

  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { usersRef.current = usersDb; }, [usersDb]);

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

  // 2. Fetch Data from Firestore
  useEffect(() => {
    if (!fbUser) return;

    const projectsColRef = collection(getFbDb(),'chk_projects');
    const usersColRef = collection(getFbDb(),'chk_users');
    const crmProjectsColRef = collection(getFbDb(),'projects');

    const handleFbError = (error) => {
      console.error(error);
      if (error.message?.includes('permissions') || error.code === 'permission-denied') {
        setFirebaseError('⚠️ Acceso denegado a Firebase. Es muy probable que tus Reglas de Seguridad de Firestore hayan expirado (el límite por defecto son 30 días). Ve a la consola de Firebase -> Firestore Database -> Rules, y actualízalas a "allow read, write: if true;".');
      }
    };

    const unsubsProjects = onSnapshot(projectsColRef, (snapshot) => {
      const loadedProjects = snapshot.docs.map(d => d.data());
      loadedProjects.sort((a, b) => b.id.localeCompare(a.id));
      setProjects(loadedProjects);
      setFirebaseError(''); // Limpiar error si conecta
    }, handleFbError);

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

    const unsubsCrmProjects = onSnapshot(crmProjectsColRef, (snapshot) => {
      const loadedCrmProjects = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setCrmProjects(loadedCrmProjects);
    }, handleFbError);

    return () => {
      unsubsProjects();
      unsubsUsers();
      unsubsCrmProjects();
    };
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
          {(view === 'dashboard' || view === 'projects') && (
            <div className="max-w-5xl mx-auto animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{view === 'dashboard' ? 'Resumen General' : 'Directorio de Proyectos'}</h2>
                {['Administrador del sistema', 'Gerente Comercial', 'Subgerente Comercial', 'Project Manager'].includes(role) && (
                  <div className="flex gap-3 items-center">
                    <button onClick={() => setShowNewProjectModal(true)} className="bg-[#899264] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#788253] transition-colors shadow-sm flex items-center gap-2">
                      <Plus size={18} /> {view === 'dashboard' ? 'Activar Nuevo Proyecto' : 'Nuevo Proyecto'}
                    </button>
                  </div>
                )}
              </div>
              
              {view === 'dashboard' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-sm font-medium mb-1">Avance Global Checklist</p>
                      <div className="flex items-end gap-2">
                        <h3 className="text-3xl font-bold text-[#899264]">{kpis.progress}%</h3>
                      </div>
                      <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden">
                        <div className="bg-[#899264] h-full" style={{width: `${kpis.progress}%`}}></div>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-sm font-medium mb-1">Proyectos Activos</p>
                      <h3 className="text-3xl font-bold text-slate-800">{projects.length}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-sm font-medium mb-1">Mis Tareas Pendientes</p>
                      <div className="flex items-center gap-2">
                        <h3 className="text-3xl font-bold text-[#DCA75D]">{kpis.myPendingApprovals}</h3>
                        {kpis.myPendingApprovals > 0 && <AlertCircle size={20} className="text-[#DCA75D]" />}
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-sm font-medium mb-1">Observaciones Activas</p>
                      <h3 className="text-3xl font-bold text-orange-500">{kpis.observations}</h3>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2">
                    <BarChart3 size={20} className="text-[#DCA75D]"/> Rendimiento y Tiempos por Área
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[#788A87]">
                        <tr>
                          <th className="p-4 font-medium">Área</th>
                          <th className="p-4 font-medium text-center">Tpo. Promedio 1ra Carga</th>
                          <th className="p-4 font-medium text-center">Repactaciones (Fechas Lím.)</th>
                          <th className="p-4 font-medium text-center">Nuevas Versiones Subidas</th>
                          <th className="p-4 font-medium text-center">Docs. Atrasados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaStats.map((stat, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-semibold text-slate-700">{stat.name}</td>
                            <td className="p-4 text-center">
                              {stat.uploadTimes.length > 0 ? (
                                <span className="text-[#899264] font-bold bg-[#899264]/10 px-2.5 py-1 rounded-full">{stat.avgUpload} días</span>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Sin datos</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`font-medium ${stat.deadlineChanges > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                {stat.deadlineChanges}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`font-medium ${stat.versions > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                {stat.versions}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {stat.overdueDocs > 0 ? (
                                <button
                                  onClick={() => setShowOverdueModal({ areaName: stat.name, docs: stat.overdueDocsList })}
                                  className="font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors flex items-center justify-center gap-1 mx-auto shadow-sm border border-red-200"
                                  title="Ver detalle de documentos atrasados"
                                >
                                  {stat.overdueDocs} <Eye size={14} />
                                </button>
                              ) : (
                                <span className="font-medium text-slate-400">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {view === 'dashboard' && <h3 className="text-lg font-bold mb-4 text-slate-800">Proyectos en Preparación</h3>}
              
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[#788A87]">
                    <tr>
                      <th className="p-4 font-medium">ID / Proyecto</th>
                      <th className="p-4 font-medium">Cliente</th>
                      <th className="p-4 font-medium">Estado General</th>
                      <th className="p-4 font-medium">Progreso Checklist</th>
                      <th className="p-4 font-medium text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => {
                      let tDocs = 0, aDocs = 0;
                      const approverNames = new Set();

                      Object.values(p.areas || {}).forEach(a => {
                        a.docs.forEach(d => { 
                          tDocs++; 
                          if(d.status === 'Aprobado' || d.status === 'Aprobado con observaciones') aDocs++; 
                          d.history.forEach(h => {
                            if (h.action.includes('Aprobó')) approverNames.add(h.user);
                          });
                        });
                      });
                      const pct = tDocs===0 ? 0 : Math.round((aDocs/tDocs)*100);
                      const approversArr = Array.from(approverNames).slice(0, 4);
                      const extraApprovers = approverNames.size - approversArr.length;

                      return (
                        <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${p.status === 'Aprobado para ejecución' ? 'bg-green-50/30' : ''}`}>
                          <td className="p-4">
                            <div className="font-semibold text-slate-800">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.id}</div>
                          </td>
                          <td className="p-4 text-slate-600">{p.client}</td>
                          <td className="p-4">
                            <StatusBadge status={p.status} />
                            {p.status === 'Aprobado para ejecución' && (
                              <div className="mt-2 text-xs font-bold text-[#899264] flex items-center gap-1">
                                <CheckCircle2 size={14} /> ¡Proyecto 100% Aprobado!
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium w-8">{pct}%</span>
                              <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${pct === 100 ? 'bg-[#899264]' : 'bg-[#DCA75D]'}`} style={{width: `${pct}%`}}></div>
                              </div>
                            </div>
                            {approverNames.size > 0 && (
                              <div className="flex items-center mt-1 -space-x-1.5" title={`Aprobado por: ${Array.from(approverNames).join(', ')}`}>
                                {approversArr.map((name, i) => (
                                  <div key={i} className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm">
                                    {name.charAt(0)}
                                  </div>
                                ))}
                                {extraApprovers > 0 && (
                                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm">
                                    +{extraApprovers}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2 w-full">
                              {['Administrador del sistema', 'Gerente General', 'Subgerente Comercial'].includes(role) && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setProjectToDelete(p); }}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                  title="Eliminar proyecto"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              <button 
                                onClick={() => { setSelectedProject(p); setView('project_detail'); }}
                                className="text-[#899264] hover:text-[#788253] font-medium text-sm flex items-center gap-1 bg-white border border-[#899264] px-3 py-1.5 rounded-md"
                              >
                                Ver Ficha <ChevronRight size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500">No hay proyectos activos en este momento.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: GANTT CHART */}
          {view === 'gantt' && (
            <div className="max-w-6xl mx-auto animate-fade-in flex flex-col h-full min-h-[calc(100vh-120px)]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Carta Gantt de Proyectos</h2>
                  <p className="text-sm text-slate-500">Tiempos calculados automáticamente según las fechas límite del checklist.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
                {!ganttData ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-16 text-center my-auto">
                    <CalendarDays size={64} className="mb-4 opacity-20" />
                    <p className="font-bold text-xl text-slate-600 mb-2">No hay suficientes datos</p>
                    <p className="text-sm max-w-md">Para generar la Carta Gantt visual, debes asignar "Fechas Límite" a los documentos de los proyectos.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto bg-white custom-scrollbar pb-8">
                    <div className="min-w-max">
                      <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
                        <div className="w-72 shrink-0 border-r border-slate-200 p-4 font-bold text-slate-700 bg-slate-50 sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Proyecto y Cliente</div>
                        <div className="relative flex" style={{ width: ganttData.months.length * 150 }}>
                          {ganttData.months.map((m) => (
                            <div key={m.getTime()} style={{ width: 150 }} className="border-r border-slate-200 p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                              {m.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex pointer-events-none z-0 ml-72" style={{ width: ganttData.months.length * 150 }}>
                          {ganttData.months.map((m) => (<div key={m.getTime()} style={{ width: 150 }} className="border-r border-slate-100 h-full" />))}
                        </div>

                        {ganttData.projectTimelines.map((project) => {
                          const leftPx = ((project.startMs - ganttData.startTimeline.getTime()) / ganttData.totalMs) * (ganttData.months.length * 150);
                          let widthPx = ((project.endMs - project.startMs) / ganttData.totalMs) * (ganttData.months.length * 150);
                          if (widthPx < 28) widthPx = 28; 

                          return (
                            <div key={project.id} className="flex border-b border-slate-100 hover:bg-slate-50 group relative z-10 transition-colors h-16">
                              <div className="w-72 shrink-0 border-r border-slate-200 px-4 py-2 bg-white group-hover:bg-slate-50 sticky left-0 z-20 flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] transition-colors">
                                <span className="font-bold text-sm text-slate-800 truncate cursor-pointer hover:text-[#929965]" onClick={() => { setSelectedProject(project); setView('project_detail'); }}>{project.name}</span>
                                <span className="text-xs text-slate-400 truncate mt-0.5">{project.client}</span>
                              </div>
                              <div className="relative" style={{ width: ganttData.months.length * 150 }}>
                                <div 
                                  className={`absolute h-8 rounded-lg shadow-sm flex items-center px-3 text-xs font-medium text-white overflow-hidden cursor-pointer transition-transform hover:scale-[1.01] hover:brightness-110 ${project.status === 'Aprobado para ejecución' ? 'bg-[#899264]' : 'bg-[#DCA75D]'}`} 
                                  style={{ left: leftPx, width: widthPx, top: '50%', transform: 'translateY(-50%)' }} 
                                  onClick={() => { setSelectedProject(project); setView('project_detail'); }} 
                                  title={`Proyecto: ${project.name}\nInicio Checklist: ${new Date(project.startMs).toLocaleDateString('es-CL')}\nFin Checklist: ${new Date(project.endMs).toLocaleDateString('es-CL')}`}
                                >
                                  <span className="truncate w-full text-center drop-shadow-sm font-semibold">{project.status}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: PROJECT DETAILS */}
          {view === 'project_detail' && selectedProject && (() => {
            const p = projects.find(proj => proj.id === selectedProject.id) || selectedProject;
            
            return (
            <div className="max-w-5xl mx-auto animate-fade-in">
              <button onClick={() => setView('dashboard')} className="text-sm text-[#788A87] hover:text-slate-800 mb-4 flex items-center gap-1">
                &larr; Volver al Dashboard
              </button>
              
              <div className="bg-white rounded-xl border-t-4 border-t-[#DCA75D] border-x border-b border-slate-200 p-6 shadow-sm mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{p.name}</h2>
                  <p className="text-[#788A87] text-sm mb-4">{p.client} • {p.type}</p>
                  
                  <div className="flex gap-6 text-sm">
                    <div><span className="text-slate-400 block text-xs">Resp. Comercial</span><span className="font-medium text-slate-700">{p.commercialLead}</span></div>
                    <div><span className="text-slate-400 block text-xs">Resp. Técnico</span><span className="font-medium text-slate-700">{p.technicalLead}</span></div>
                    <div><span className="text-slate-400 block text-xs">Resp. Operativo</span><span className="font-medium text-slate-700">{p.operationalLead}</span></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2"><StatusBadge status={p.status} /></div>
                  <p className="text-xs text-slate-500 mt-2">Activado: {p.activationDate}</p>
                  {p.status === 'Aprobado para ejecución' && (
                    <button className="mt-3 bg-[#899264] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#788253] shadow-md animate-pulse">
                      <PlayCircle size={18} /> Iniciar Ejecución Oficial
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><CheckSquare size={20} className="text-[#899264]"/> Checklist de Aprobación por Área</h3>
              
              <div className="flex flex-col gap-6">
                {Object.entries(p.areas || {}).map(([areaKey, area]) => (
                  <div key={areaKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h4 className="font-semibold text-slate-800 uppercase text-sm tracking-wide">{area.name}</h4>
                      <StatusBadge status={area.status} />
                    </div>
                    <div className="p-0">
                      <table className="w-full text-sm">
                        <thead className="bg-white border-b border-slate-100 text-[#788A87] text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-5 py-3 text-left font-medium">Entregable Obligatorio</th>
                            <th className="px-5 py-3 text-left font-medium">Versión</th>
                            <th className="px-5 py-3 text-left font-medium">Estado</th>
                            <th className="px-5 py-3 text-left font-medium">Fecha Límite</th>
                            <th className="px-5 py-3 text-right font-medium">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {area.docs.map(doc => {
                            const canUpload = 
                              role === doc.uploaderRole || 
                              role === 'Administrador del sistema' ||
                              (areaKey === 'comercial' && (role === p.commercialLead || role === 'Project Manager' || role === 'Subgerente Comercial' || role === 'Gerente Comercial')) ||
                              (areaKey === 'ingenieria' && (role === p.technicalLead || role === 'Project Manager' || role === 'Subgerente Comercial')) ||
                              (areaKey === 'operaciones' && (role === p.operationalLead || role === 'Gerente de Operaciones' || role === 'Project Manager' || role === 'Subgerente Comercial'));

                            const isApprover = APPROVERS[areaKey.toUpperCase()]?.includes(role) || role === 'Administrador del sistema';
                            const needsMyApproval = doc.status === 'En revisión' && isApprover && doc.approvals[role] !== 'Aprobado' && doc.approvals[role] !== 'Aprobado con obs.';
                            const canEditDeadline = ['Gerente General', 'Subgerente Comercial', 'Project Manager', 'Administrador del sistema'].includes(role);

                            return (
                            <tr key={doc.id} className="hover:bg-slate-50/50">
                              <td className="px-5 py-4">
                                <div className="font-medium text-slate-800 flex items-center gap-2">
                                  <FileText size={16} className="text-slate-400"/> {doc.name}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-[#788A87] font-mono text-xs">{doc.version}</td>
                              <td className="px-5 py-4">
                                <StatusBadge status={doc.status} />
                              </td>
                              
                              <td className="px-5 py-4">
                                {editingDeadline?.docId === doc.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="date"
                                      value={editingDeadline.value}
                                      onChange={e => setEditingDeadline({...editingDeadline, value: e.target.value})}
                                      className="text-xs p-1 border border-[#899264] rounded focus:outline-none"
                                    />
                                    <button onClick={() => handleSaveDeadline(p.id, areaKey, doc.id, editingDeadline.value)} className="text-green-600 hover:bg-green-50 p-1 rounded transition-colors"><CheckCircle2 size={16}/></button>
                                    <button onClick={() => setEditingDeadline(null)} className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"><XCircle size={16}/></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {doc.deadline ? (
                                      <>
                                        <span className="text-sm text-slate-700 font-medium">{doc.deadline.split('-').reverse().join('-')}</span>
                                        {doc.deadlineVersion > 1 && (
                                          <span className="text-[10px] bg-[#DCA75D]/20 text-[#DCA75D] font-bold px-1.5 py-0.5 rounded">V{doc.deadlineVersion}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-xs text-slate-400 italic">Sin definir</span>
                                    )}

                                    {canEditDeadline && (
                                      <button
                                        onClick={() => setEditingDeadline({docId: doc.id, value: doc.deadline || ''})}
                                        className="text-slate-300 hover:text-[#899264] p-1 transition-colors"
                                        title="Editar fecha límite"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  {canUpload && doc.status !== 'Aprobado' && doc.status !== 'Aprobado con observaciones' && (
                                    <div className="relative">
                                      {!doc.fileUrl ? (
                                        <>
                                          <input 
                                            type="file" 
                                            id={`file-${doc.id}`} 
                                            className="hidden" 
                                            onChange={(e) => {
                                              if (e.target.files[0]) {
                                                handleFileUpload(p.id, areaKey, doc.id, e.target.files[0]);
                                              }
                                              e.target.value = null;
                                            }} 
                                          />
                                          <button 
                                            onClick={() => document.getElementById(`file-${doc.id}`).click()}
                                            disabled={uploadingDocs[doc.id]}
                                            className={`p-1.5 text-[#899264] bg-[#899264]/10 rounded hover:bg-[#899264]/20 transition-colors ${uploadingDocs[doc.id] ? 'opacity-50 cursor-wait' : ''}`} 
                                            title="Subir archivo y generar nueva versión"
                                          >
                                            {uploadingDocs[doc.id] ? <Loader className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                                          </button>
                                        </>
                                      ) : (
                                        <button 
                                          disabled
                                          className="p-1.5 text-slate-400 bg-slate-100 rounded cursor-not-allowed" 
                                          title="Debes eliminar el archivo actual en 'Ver Detalle' para poder subir la siguiente versión"
                                        >
                                          <UploadCloud size={18} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  
                                  {(doc.status !== 'Pendiente') && (
                                    <button 
                                      onClick={() => setSelectedDoc({projectId: p.id, areaKey, doc})}
                                      className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-1 transition-colors
                                        ${needsMyApproval 
                                          ? 'bg-[#899264] text-white border-[#899264] hover:bg-[#788253] shadow-sm animate-pulse-soft' 
                                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                    >
                                      {needsMyApproval ? <CheckCircle2 size={14}/> : <Eye size={14}/>}
                                      {needsMyApproval ? 'Revisar' : 'Ver Detalle'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
          })()}

          {/* VIEW: MY APPROVALS */}
          {view === 'approvals' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                <CheckSquare className="text-[#DCA75D]"/> Bandeja de Aprobaciones
              </h2>
              <p className="text-[#788A87] mb-6">Hola <strong>{currentUser.name}</strong>, estos son los documentos que requieren tu revisión para permitir el inicio de los proyectos.</p>

              <div className="flex flex-col gap-4">
                {projects.flatMap(p => 
                  Object.entries(p.areas || {}).flatMap(([areaKey, area]) => 
                    area.docs
                      .filter(d => d.status === 'En revisión' && APPROVERS[areaKey.toUpperCase()]?.includes(role) && d.approvals[role] !== 'Aprobado' && d.approvals[role] !== 'Aprobado con obs.')
                      .map(doc => (
                        <div key={`${p.id}-${doc.id}`} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-[#DCA75D] transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="bg-[#DCA75D]/10 p-3 rounded-lg text-[#DCA75D] mt-1">
                              <FileText size={24} />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[#899264] mb-1 uppercase tracking-wide">{p.name} • {area.name}</div>
                              <h4 className="text-lg font-bold text-slate-800">{doc.name}</h4>
                              <p className="text-sm text-[#788A87] mt-1 flex items-center gap-1">
                                <Clock size={14}/> Asignado a: {doc.uploaderRole} • Versión {doc.version}
                                {doc.deadline && <span className="ml-2 bg-red-100 text-red-600 px-1.5 rounded text-xs flex items-center gap-1"><CalendarDays size={12}/> {doc.deadline.split('-').reverse().join('-')}</span>}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => { setSelectedProject(p); setSelectedDoc({projectId: p.id, areaKey, doc}) }}
                            className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm"
                          >
                            Revisar Documento
                          </button>
                        </div>
                      ))
                  )
                )}
                {kpis.myPendingApprovals === 0 && (
                  <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
                    <CheckCircle2 size={48} className="mx-auto text-slate-300 mb-3" />
                    <h3 className="text-lg font-medium text-slate-500">Todo al día</h3>
                    <p className="text-sm text-slate-400">No tienes documentos pendientes de revisión.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL: DOCUMENT OVERDUE DETAILS */}
      {showOverdueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up border-t-4 border-t-red-500">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="text-red-500"/> Detalle de Atrasos: {showOverdueModal.areaName}
              </h3>
              <button onClick={() => setShowOverdueModal(null)} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-slate-100 text-[#788A87] text-xs uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-5 py-3 font-medium">Proyecto</th>
                    <th className="px-5 py-3 font-medium">Documento</th>
                    <th className="px-5 py-3 font-medium">Responsable de Carga</th>
                    <th className="px-5 py-3 font-medium">Fecha Límite</th>
                    <th className="px-5 py-3 font-medium">Estado Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {showOverdueModal.docs.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-800">{doc.projectName}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {doc.docName} <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded ml-1 font-mono text-slate-500">{doc.version}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 flex items-center gap-1 mt-1">
                        <User size={14} className="text-slate-400"/> {doc.uploaderRole}
                      </td>
                      <td className="px-5 py-4 font-medium text-red-600 flex items-center gap-1">
                        <CalendarDays size={14}/> {doc.deadline.split('-').reverse().join('-')}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={doc.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setShowOverdueModal(null)} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT REVIEW & AUDIT */}
      {selectedDoc && (() => {
        const canApproveWithObs = ['Gerente General', 'Gerente Comercial', 'Subgerente Comercial', 'Project Manager'].includes(role);

        return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
            
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <span className="text-xs font-bold text-[#899264] uppercase tracking-wider">{selectedDoc.areaKey}</span>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {selectedDoc.doc.name} <span className="text-sm font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{selectedDoc.doc.version}</span>
                </h3>
              </div>
              <button onClick={() => { setSelectedDoc(null); setChatMessage(''); }} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8">
              
              <div className="flex-1">
                <div className="mb-6 flex gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 mb-2">Estado Actual</h4>
                    <StatusBadge status={selectedDoc.doc.status} />
                  </div>
                  {selectedDoc.doc.deadline && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 mb-2">Fecha Límite</h4>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-red-50 text-red-600 border-red-200 flex items-center gap-1 w-max">
                        <CalendarDays size={14}/> {selectedDoc.doc.deadline.split('-').reverse().join('-')}
                        {selectedDoc.doc.deadlineVersion > 1 && ` (V${selectedDoc.doc.deadlineVersion})`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="w-full bg-slate-100 rounded-lg border border-slate-200 p-6 flex flex-col items-center justify-center text-slate-400 mb-6 relative overflow-hidden">
                  <MayuLogo className="absolute opacity-5 h-48 w-auto pointer-events-none" />
                  
                  <FileText size={48} className={`mb-3 relative z-10 ${selectedDoc.doc.fileUrl ? 'text-[#899264]' : 'opacity-50'}`} />
                  
                  {selectedDoc.doc.fileUrl ? (
                    <>
                      <p className="text-sm font-medium relative z-10 text-center truncate w-full text-slate-600 mb-2" title={selectedDoc.doc.originalFileName}>
                        {selectedDoc.doc.originalFileName}
                      </p>
                      <div className="flex gap-2 relative z-10">
                        <a 
                          href={selectedDoc.doc.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-white border-2 border-[#899264] text-[#899264] px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[#899264] hover:text-white transition-colors shadow-sm"
                        >
                          Descargar Archivo
                        </a>
                        {(role === selectedDoc.doc.uploaderRole || role === 'Administrador del sistema') && selectedDoc.doc.status !== 'Aprobado' && selectedDoc.doc.status !== 'Aprobado con observaciones' && (
                          <button 
                            onClick={() => {
                              handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'DELETE_FILE');
                              setSelectedDoc(null);
                            }}
                            className="bg-white border-2 border-red-500 text-red-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-red-500 hover:text-white transition-colors shadow-sm flex items-center justify-center gap-1"
                            title="Borrar archivo de la nube para subir nueva versión"
                          >
                            <Trash2 size={16} /> Eliminar para subir nueva versión
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm font-medium relative z-10">Archivo no disponible</p>
                  )}
                </div>

                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-slate-500 mb-3 border-b pb-2">Estado de Firmas Obligatorias</h4>
                  <ul className="space-y-2">
                    {APPROVERS[selectedDoc.areaKey.toUpperCase()]?.map(appr => {
                      const st = selectedDoc.doc.approvals[appr];
                      return (
                        <li key={appr} className="flex justify-between items-center text-sm p-2 rounded bg-slate-50 border border-slate-100">
                          <span className={appr === role ? 'font-bold text-[#899264]' : 'text-[#788A87]'}>{appr}</span>
                          {st === 'Aprobado' ? <span className="text-green-600 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={14}/> Aprobado</span> :
                           st === 'Aprobado con obs.' ? <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={14}/> Aprobado con obs.</span> :
                           st === 'Rechazado' ? <span className="text-red-600 flex items-center gap-1 text-xs font-bold"><XCircle size={14}/> Rechazado</span> :
                           st === 'Observado' ? <span className="text-orange-600 flex items-center gap-1 text-xs font-bold"><AlertCircle size={14}/> Observado</span> :
                           <span className="text-slate-400 text-xs flex items-center gap-1"><Clock size={14}/> Pendiente</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {APPROVERS[selectedDoc.areaKey.toUpperCase()]?.includes(role) && 
                 ['En revisión', 'Observado'].includes(selectedDoc.doc.status) && (
                  <div className="bg-[#899264]/10 p-4 rounded-xl border border-[#899264]/20">
                    <h4 className="text-sm font-bold text-[#454a32] mb-3 flex items-center gap-2"><CheckSquare size={16}/> Tu Decisión ({currentUser.name})</h4>
                    <textarea 
                      className="w-full text-sm p-3 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-[#899264]"
                      rows="3"
                      placeholder="Agrega comentarios u observaciones (Obligatorio si rechazas, observas o apruebas con observaciones)..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                    ></textarea>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'APPROVE')} className="w-full bg-[#899264] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#788253] flex justify-center items-center gap-2">
                        <CheckCircle2 size={18} /> Aprobar
                      </button>
                      {canApproveWithObs && (
                        <button 
                          onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'APPROVE_WITH_OBS', commentText)} 
                          disabled={!commentText.trim()}
                          className={`w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-2 ${!commentText.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                          title={!commentText.trim() ? 'Requiere comentario para aprobar con observaciones' : ''}
                        >
                          <CheckCircle2 size={18} /> Aprobar con Obs.
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'OBSERVE', commentText)} className="w-full bg-[#DCA75D] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c49352] flex justify-center items-center gap-2">
                        <MessageSquare size={18} /> Observar
                      </button>
                      <button onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'REJECT', commentText)} className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex justify-center items-center gap-2">
                        <XCircle size={18} /> Rechazar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-8 border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-[#899264]" /> Muro de Conversación
                  </h4>
                  <div className="bg-[#F8F9F7] rounded-xl p-4 border border-slate-200 flex flex-col h-72">
                    <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4 pr-2 custom-scrollbar">
                      {(selectedDoc.doc.messages || []).length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center my-auto">No hay mensajes. ¡Escribe el primero para iniciar la conversación!</p>
                      ) : (
                        (selectedDoc.doc.messages || []).map(msg => (
                          <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.user === currentUser.name ? 'self-end items-end' : 'self-start items-start'}`}>
                            <div className={`px-3 py-2 rounded-lg text-sm shadow-sm ${msg.user === currentUser.name ? 'bg-[#899264] text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{msg.user} • {new Date(msg.timestamp).toLocaleString('es-CL', {dateStyle: 'short', timeStyle: 'short'})}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 text-sm p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#899264]"
                        placeholder="Escribe un mensaje para el equipo..."
                        value={chatMessage}
                        onChange={e => setChatMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      />
                      <button 
                        onClick={handleSendMessage} 
                        disabled={!chatMessage.trim()} 
                        className="bg-[#899264] text-white px-4 py-2 rounded-lg hover:bg-[#788253] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              <div className="w-full md:w-64 border-l border-slate-200 pl-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <History size={18} className="text-slate-400" /> Trazabilidad
                </h4>
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                  {selectedDoc.doc.history.map((hist, i) => (
                    <div key={i} className="relative pl-5">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${hist.action.includes('Cargó') ? 'bg-[#788A87]' : hist.action.includes('Aprobó') ? 'bg-[#899264]' : hist.action.includes('Rechazó') ? 'bg-red-500' : hist.action.includes('fecha') ? 'bg-blue-400' : 'bg-[#DCA75D]'}`}></div>
                      <p className="text-[10px] text-slate-400 font-mono mb-0.5">{hist.date}</p>
                      <p className="text-xs font-semibold text-slate-700">{hist.user}</p>
                      <p className="text-xs text-[#788A87] mt-1">{hist.action}</p>
                    </div>
                  ))}
                  {selectedDoc.doc.history.length === 0 && (
                    <p className="text-xs text-slate-400 italic pl-4">No hay historial registrado aún.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

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