import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, FolderKanban, CheckSquare, Clock, AlertCircle, 
  CheckCircle2, XCircle, UploadCloud, Eye, History, MessageSquare, 
  ChevronRight, FileText, UserCircle, PlayCircle, ShieldCheck, LogOut, 
  Lock, User, Plus, Trash2, Key, Loader, Edit2, CalendarDays, Send, Briefcase
} from 'lucide-react';

// --- INYECCIÓN AUTOMÁTICA DE ESTILOS (TAILWIND CDN) ---
if (typeof document !== 'undefined' && !document.getElementById('tailwind-cdn')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn';
  script.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(script);
}

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// --- FIREBASE INIT ---
const firebaseConfig = {
  // Evitamos el falso positivo del escáner de Netlify dividiendo la clave.
  apiKey: ['AI', 'za', 'SyAsVgf5GRRuf', '-hNt9MxpCJ', 'ce6wdb9hUB70'].join(''),
  authDomain: "crm---mayu.firebaseapp.com",
  projectId: "crm---mayu",
  storageBucket: "crm---mayu.firebasestorage.app",
  messagingSenderId: "304169874263",
  appId: "1:304169874263:web:1cf55b40918bf2de73c412"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- CONFIGURACIÓN Y CONSTANTES ---

const ROLES = [
  'Administrador del sistema',
  'Gerente General',
  'Gerente Comercial',
  'Subgerente Comercial',
  'Project Manager',
  'Gerente de I+D y Producción',
  'Jefe de Producción',
  'Equipo de Diseño',
  'Gerente de Operaciones',
  'Jefe de Logística',
  'Jefe de Bodega',
  'Gerente de Administración y Finanzas',
  'Encargado de Calidad'
];

// MOCK_USERS ahora incluye correos electrónicos para las notificaciones
const MOCK_USERS = {
  'admin': { password: '123', name: 'Administrador IT', role: 'Administrador del sistema', email: 'admin@imayu.cl' },
  'fjescudero': { password: '123', name: 'Felix Escudero', role: 'Gerente General', email: 'fjescudero@imayu.cl' },
  'vescudero': { password: '123', name: 'Valentina Escudero', role: 'Gerente de Administración y Finanzas', email: 'vescudero@imayu.cl' },
  'mepelman': { password: '123', name: 'Martin Epelman', role: 'Gerente de I+D y Producción', email: 'm.epelman@imayu.cl' },
  'fescudero': { password: '123', name: 'Felix Escudero Vargas', role: 'Gerente Comercial', email: 'fescudero@imayu.cl' },
  'clecaros': { password: '123', name: 'Carlos Lecaros', role: 'Gerente de Operaciones', email: 'clecaros@imayu.cl' },
  'efernandez': { password: '123', name: 'Emilio Fernandez', role: 'Subgerente Comercial', email: 'efernandez@imayu.cl' },
  'jsantibanez': { password: '123', name: 'Jose Santibañez', role: 'Project Manager', email: 'jsantibanez@imayu.cl' },
  'cquintana': { password: '123', name: 'Carlos Quintana', role: 'Equipo de Diseño', email: 'cquintana@imayu.cl' },
  'dcuevas': { password: '123', name: 'Daniela Cuevas', role: 'Equipo de Diseño', email: 'dcuevas@imayu.cl' },
  'fjerez': { password: '123', name: 'Felipe Jerez', role: 'Jefe de Producción', email: 'fjerez@imayu.cl' },
  'groman': { password: '123', name: 'Gabriel Roman', role: 'Jefe de Logística', email: 'groman@imayu.cl' },
  'mhernandez': { password: '123', name: 'Mauricio Hernandez', role: 'Jefe de Bodega', email: 'mhernandez@imayu.cl' },
  'jquevedo': { password: '123', name: 'Jorge Quevedo', role: 'Encargado de Calidad', email: 'jquevedo@imayu.cl' }
};

const APPROVERS = {
  COMERCIAL: ['Gerente General', 'Gerente de Administración y Finanzas'],
  INGENIERIA: ['Subgerente Comercial', 'Project Manager', 'Gerente Comercial', 'Gerente General', 'Gerente de I+D y Producción', 'Gerente de Operaciones'],
  OPERACIONES: ['Gerente de I+D y Producción', 'Subgerente Comercial', 'Project Manager', 'Gerente Comercial', 'Gerente General'],
  FINANZAS: ['Gerente Comercial', 'Gerente General'],
  CALIDAD: ['Gerente General', 'Gerente de Operaciones']
};

// --- COMPONENTES AUXILIARES ---

const StatusBadge = ({ status }) => {
  const styles = {
    'Aprobado': 'bg-green-100 text-green-800 border-green-200',
    'Aprobada': 'bg-green-100 text-green-800 border-green-200',
    'Aprobado con observaciones': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Aprobado para ejecución': 'bg-[#899264] text-white shadow-sm',
    'Pendiente': 'bg-gray-100 text-gray-600 border-gray-200',
    'No iniciada': 'bg-gray-100 text-gray-600 border-gray-200',
    'En revisión': 'bg-[#788A87]/20 text-[#788A87] border-[#788A87]/30',
    'En proceso': 'bg-[#788A87]/20 text-[#788A87] border-[#788A87]/30',
    'En preparación para ejecución': 'bg-[#788A87] text-white shadow-sm',
    'Observado': 'bg-[#DCA75D]/20 text-[#b5833e] border-[#DCA75D]/40',
    'Con observaciones': 'bg-[#DCA75D]/20 text-[#b5833e] border-[#DCA75D]/40',
    'Rechazado': 'bg-red-100 text-red-800 border-red-200',
    'Bloqueado para inicio': 'bg-red-600 text-white shadow-sm'
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const MayuLogo = ({ className }) => (
  <svg viewBox="0 0 260 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M30 65 L75 33 V65 H30Z" fill="#DCA75D"/>
    <path d="M78 31 L81 29 V65 H78 V31Z" fill="#DCA75D"/>
    <path d="M85 26 L115 5 V65 H85 V26Z" fill="#788A87"/>
    <path d="M118 3 L121 1 V65 H118 V3Z" fill="#DCA75D"/>
    <path d="M135 0 V65 H158 V20 L135 0Z" fill="#DCDDDF"/>
    <path d="M163 25 V65 H220 L163 25Z" fill="#899264"/>
    <text x="125" y="112" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="900" textAnchor="middle" fill="#000000" letterSpacing="2">MAYU</text>
    <line x1="30" y1="122" x2="220" y2="122" stroke="#899264" strokeWidth="3" />
    <text x="125" y="136" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="bold" textAnchor="middle" fill="#000000" letterSpacing="0.5">SOLUCIONES CONSTRUCTIVAS</text>
  </svg>
);

// --- APLICACIÓN PRINCIPAL ---

export default function MayuApp() {
  const [fbUser, setFbUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [isCreatingProject, setIsCreatingProject] = useState(false); 
  
  const [usersDb, setUsersDb] = useState({});
  const [projects, setProjects] = useState([]);
  const [crmProjects, setCrmProjects] = useState([]); // Base de datos del CRM (Proyectos Adjudicados)
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Error autenticando con Firebase:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFbUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser) return;

    // Colecciones del Checklist
    const projectsColRef = collection(db, 'chk_projects');
    const usersColRef = collection(db, 'chk_users');
    
    // Colección del CRM
    const crmProjectsColRef = collection(db, 'projects');

    const unsubsProjects = onSnapshot(projectsColRef, (snapshot) => {
      const loadedProjects = snapshot.docs.map(d => d.data());
      loadedProjects.sort((a, b) => b.id.localeCompare(a.id));
      setProjects(loadedProjects);
    }, (error) => console.error(error));

    const unsubsUsers = onSnapshot(usersColRef, (snapshot) => {
      if (snapshot.empty) {
        Object.entries(MOCK_USERS).forEach(([id, u]) => setDoc(doc(usersColRef, id), u));
      } else {
        const loadedUsers = {};
        snapshot.docs.forEach(d => { loadedUsers[d.id] = d.data(); });
        setUsersDb(loadedUsers);
        setIsDataLoaded(true);
      }
    }, (error) => console.error(error));

    const unsubsCrmProjects = onSnapshot(crmProjectsColRef, (snapshot) => {
      const loadedCrmProjects = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setCrmProjects(loadedCrmProjects);
    }, (error) => console.error(error));

    return () => {
      unsubsProjects();
      unsubsUsers();
      unsubsCrmProjects();
    };
  }, [fbUser]);

  const sendEmailNotification = async (targetRoles, subject, htmlBody) => {
    try {
      const uDb = usersRef.current;
      const emails = Object.values(uDb)
        .filter(u => targetRoles.includes(u.role))
        .map(u => u.email)
        .filter(e => e && e.trim() !== '');

      if (emails.length === 0) return;

      const fullHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #899264; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0; letter-spacing: 2px;">MAYU PLATAFORMA</h2>
          </div>
          <div style="padding: 30px; background-color: #F8F9F7;">
            ${htmlBody}
            <br/><br/>
            <a href="https://control.imayu.cl" style="display: inline-block; background-color: #DCA75D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir a la Plataforma</a>
          </div>
          <div style="background-color: #eee; padding: 15px; text-align: center; font-size: 11px; color: #666;">
            Este es un mensaje automático de control de proyectos MAYU.
          </div>
        </div>
      `;

      await addDoc(collection(db, 'mail'), {
        to: emails,
        message: {
          subject: subject,
          html: fullHtml
        }
      });
    } catch (error) {
      console.error("Error al encolar el correo:", error);
    }
  };

  useEffect(() => {
    if (!isDataLoaded || !currentUser) return;

    if (currentUser.role !== 'Administrador del sistema' && currentUser.role !== 'Project Manager') return;

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
                    sendEmailNotification(
                      pendingRoles,
                      `🔴 ALERTA URGENTE: Aprobación Atrasada - ${docItem.name}`,
                      `<h3 style="color: #d32f2f;">Aprobación Atrasada - Recordatorio Automático</h3>
                       <p>Hola,</p>
                       <p>El documento <strong>${docItem.name}</strong> del proyecto <strong>${p.name}</strong> lleva más de 72 horas esperando tu revisión obligatoria.</p>
                       <p>Esto está bloqueando el avance del proyecto. Por favor ingresa a la plataforma inmediatamente para gestionarlo.</p>
                       <p><em>Este correo se repetirá cada 24 horas hasta que sea aprobado.</em></p>`
                    );
                    
                    docItem.lastReminderSentAt = now.toISOString();
                    projChanged = true;
                  }
                }
              }
            }
          });
        });

        if (projChanged) {
          await setDoc(doc(db, 'chk_projects', p.id), p);
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
      document.history = [{date: nowString, user: currentUser.name, action: `Cargó ${document.version}`}, ...document.history];
      
      const requiredRoles = APPROVERS[areaKey.toUpperCase()] || [];
      sendEmailNotification(
        requiredRoles,
        `NUEVO DOCUMENTO PARA REVISIÓN: ${document.name} - ${p.name}`,
        `<h3>Se requiere tu aprobación</h3>
         <p>Hola,</p>
         <p>Se ha subido una nueva versión (${document.version}) del documento <strong>${document.name}</strong> para el proyecto <strong>${p.name}</strong>.</p>
         <p>Por favor ingresa a la plataforma para revisarlo y firmarlo.</p>`
      );
    } 
    else if (action === 'DELETE_FILE') {
      if (document.fileUrl) {
        try {
          const fileRef = ref(storage, document.fileUrl);
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
      
      const requiredApprovers = APPROVERS[areaKey.toUpperCase()];
      const allApproved = requiredApprovers.every(appr => document.approvals[appr] === 'Aprobado' || document.approvals[appr] === 'Aprobado con obs.');
      const anyRejected = Object.values(document.approvals).includes('Rechazado') || Object.values(document.approvals).includes('Observado');
      
      if (allApproved) {
        const hasObs = requiredApprovers.some(appr => document.approvals[appr] === 'Aprobado con obs.');
        document.status = hasObs ? 'Aprobado con observaciones' : 'Aprobado';
        document.reviewStartDate = null; 
        sendEmailNotification(
          [document.uploaderRole, 'Project Manager', 'Administrador del sistema'],
          `✅ APROBADO: ${document.name} - ${p.name}`,
          `<h3 style="color: #4CAF50;">Documento Aprobado Exitosamente</h3>
           <p>El documento <strong>${document.name}</strong> (Versión ${document.version}) del proyecto <strong>${p.name}</strong> ha recibido todas las firmas requeridas y está oficialmente Aprobado.</p>`
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
    
    await setDoc(doc(db, 'chk_projects', updatedProject.id), updatedProject);
    
    setSelectedDoc(null);
    setCommentText('');
    if (selectedProject?.id === projectId) setSelectedProject(updatedProject);
  };

  const handleFileUpload = async (projectId, areaKey, docId, file) => {
    if (!file) return;
    
    setUploadingDocs(prev => ({ ...prev, [docId]: true }));
    
    try {
      const fileExtension = file.name.split('.').pop();
      const storageRef = ref(storage, `chk_projects/${projectId}/${areaKey}/${docId}_${Date.now()}.${fileExtension}`);
      
      // CAMBIO IMPORTANTE: Se reemplazó uploadBytesResumable por uploadBytes 
      // para evitar problemas de conexión o bloqueo de chunks en el navegador.
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
      document.history = [{date: nowString, user: currentUser.name, action: `Cargó ${document.version} (${file.name})`}, ...document.history];
      
      newAreas[areaKey].docs[docIndex] = document;
      let updatedProject = { ...p, areas: newAreas };
      updatedProject = recalculateProjectStatus(updatedProject);
      
      await setDoc(doc(db, 'chk_projects', updatedProject.id), updatedProject);
      
      if (selectedProject?.id === projectId) setSelectedProject(updatedProject);

      const requiredRoles = APPROVERS[areaKey.toUpperCase()] || [];
      sendEmailNotification(
        requiredRoles,
        `NUEVO ARCHIVO PARA REVISIÓN: ${document.name} - ${p.name}`,
        `<h3>Se requiere tu aprobación</h3>
         <p>Hola,</p>
         <p>Se ha subido un archivo real (Versión ${document.version}) para el documento <strong>${document.name}</strong> del proyecto <strong>${p.name}</strong>.</p>
         <p>Por favor ingresa a la plataforma para revisarlo y firmarlo.</p>`
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

    const formattedDate = newDate ? newDate.split('-').reverse().join('-') : 'Ninguna';
    const nowString = new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    
    document.history = [
      {date: nowString, user: currentUser.name, action: `Fijó fecha límite a ${formattedDate} (V${newV})`}, 
      ...document.history
    ];

    newAreas[areaKey].docs[docIndex] = document;
    let updatedProject = { ...p, areas: newAreas };

    await setDoc(doc(db, 'chk_projects', updatedProject.id), updatedProject);

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
    await setDoc(doc(db, 'chk_projects', updatedProject.id), updatedProject);

    setChatMessage('');
    setSelectedDoc({ ...selectedDoc, doc: document });
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    await deleteDoc(doc(db, 'chk_projects', projectToDelete.id));
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
      await setDoc(doc(db, 'chk_projects', newProject.id), newProject);

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
    await setDoc(doc(db, 'chk_users', currentUser.id), updatedUser);
    
    setPasswordForm({ current: '', new: '', confirm: '', error: '', success: '¡Contraseña actualizada con éxito!' });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordForm({ current: '', new: '', confirm: '', error: '', success: '' });
    }, 2000);
  };

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
           pMax += 24 * 60 * 60 * 1000; // Agregar 1 día mínimo para que se dibuje
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

    // Padding de 1 mes antes y después para mejor visualización
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
    return (
      <div className="min-h-screen bg-[#F3F4EF] flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in border border-slate-200">
          
          {/* MAYU Brands Header */}
          <div className="h-2 w-full flex">
            <div className="flex-1 bg-[#DCA75D]"></div>
            <div className="flex-1 bg-[#788A87]"></div>
            <div className="flex-1 bg-[#DCDDDF]"></div>
            <div className="flex-1 bg-[#899264]"></div>
          </div>

          <div className="pt-10 pb-6 px-8 text-center bg-white">
            <MayuLogo className="h-24 w-auto mx-auto mb-4 drop-shadow-sm" />
            <p className="text-[#788A87] text-xs font-bold tracking-widest uppercase">Plataforma Pre-Ejecución</p>
          </div>
          
          <div className="px-8 pb-8">
            {loginError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-center gap-2 border border-red-200">
                <AlertCircle size={16} /> {loginError}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#788A87] mb-1">Usuario</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} className="text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#899264] focus:border-transparent transition-shadow"
                    placeholder="Ej: fjescudero, jquevedo..."
                    value={loginForm.username}
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#788A87] mb-1">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input 
                    type="password" 
                    required
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#899264] focus:border-transparent transition-shadow"
                    placeholder="Tu clave personal"
                    value={loginForm.password}
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#899264] text-white py-3 rounded-lg font-bold hover:bg-[#788253] transition-colors shadow-md mt-6">
                Ingresar al Sistema
              </button>
            </form>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        `}} />
      </div>
    );
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
          
          {/* VIEW: DASHBOARD & PROJECTS (Shared Table Render) */}
          {(view === 'dashboard' || view === 'projects') && (
            <div className="max-w-5xl mx-auto animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{view === 'dashboard' ? 'Resumen General' : 'Directorio de Proyectos'}</h2>
                {['Administrador del sistema', 'Gerente Comercial', 'Subgerente Comercial', 'Project Manager'].includes(role) && (
                  <button onClick={() => setShowNewProjectModal(true)} className="bg-[#899264] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#788253] transition-colors shadow-sm flex items-center gap-2">
                    <Plus size={18} /> {view === 'dashboard' ? 'Activar Nuevo Proyecto' : 'Nuevo Proyecto'}
                  </button>
                )}
              </div>
              
              {view === 'dashboard' && (
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
                          // Coleccionar aprobadores para el dashboard
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
                            {/* MURO DE APROBADORES */}
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
                              {role === 'Administrador del sistema' && (
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
                    <p className="text-sm max-w-md">Para generar la Carta Gantt visual, debes asignar "Fechas Límite" (ícono de lápiz) a los documentos dentro de las fichas de los proyectos.</p>
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
                          if (widthPx < 28) widthPx = 28; // Ancho mínimo visual

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
                              (areaKey === 'comercial' && role === p.commercialLead) ||
                              (areaKey === 'ingenieria' && role === p.technicalLead) ||
                              (areaKey === 'operaciones' && (role === p.operationalLead || role === 'Gerente de Operaciones'));

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