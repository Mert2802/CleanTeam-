import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  writeBatch
} from 'firebase/firestore';
import { 
  Brush, Users, Settings, Calendar, CheckCircle, AlertTriangle, 
  LogOut, RefreshCw, Home, User, Menu, X, Plus, Server, Camera, 
  Image as ImageIcon, Upload, ChevronLeft, ChevronRight, Download, 
  HelpCircle, Clock, MapPin, Navigation, Edit, Save, ExternalLink, 
  ListChecks, Trash2, Share, Check, Sparkles, Wand2, MessageSquare
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDXjzLGXPS4fxMooU4MITdRSKZdoRnDU9U",
  authDomain: "cleanteam-96578.firebaseapp.com",
  projectId: "cleanteam-96578",
  storageBucket: "cleanteam-96578.firebasestorage.app",
  messagingSenderId: "1049033412494",
  appId: "1:1049033412494:web:f26ca5a7e433fe91711edf",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "cleanteam-test";

// --- Helper Functions ---
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('de-DE', { 
    weekday: 'short', 
    day: '2-digit', 
    month: 'long' 
  }).format(date);
};

const formatTime = (isoString) => {
  if (!isoString) return '--:--';
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

const calculateDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

const deg2rad = (deg) => {
  return deg * (Math.PI/180)
}

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
};

// --- Gemini AI Helper ---
const callGeminiAI = async (prompt) => {
    try {
        const apiKey = ""; // Runtime provided key
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Keine Antwort von der KI.";
    } catch (e) {
        console.error("Gemini Error:", e);
        return "Fehler bei der AI-Anfrage. Bitte später erneut versuchen.";
    }
};

const DEFAULT_CHECKLIST = [
    "Bettwäsche gewechselt",
    "Müll entsorgt & Neue Beutel",
    "Bad & Küche desinfiziert",
    "Böden gesaugt & gewischt",
    "Oberflächen abgestaubt"
];

// --- Mock Data Generator (Fallback) ---
const generateMockData = () => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  return [
    {
      id: 'mock-1',
      apartment: 'Penthouse mit Meerblick',
      date: today,
      status: 'pending',
      guestName: 'Max Mustermann',
      notes: 'Late Check-out bis 12:00 erlaubt',
      assignedTo: [], 
      checklist: DEFAULT_CHECKLIST
    },
    {
      id: 'mock-2',
      apartment: 'Studio City Center',
      date: today,
      status: 'in-progress',
      guestName: 'Lisa Müller',
      notes: '',
      assignedTo: ['staff-1'],
      checklist: DEFAULT_CHECKLIST,
      startedAt: new Date(Date.now() - 3600000).toISOString(), 
      photos: { before: [], after: [] }
    },
    {
      id: 'mock-3',
      apartment: 'Loft Industrial',
      date: tomorrow,
      status: 'completed',
      guestName: 'John Doe',
      notes: 'Weinglas zerbrochen gemeldet',
      assignedTo: ['staff-1', 'staff-2'],
      checklist: DEFAULT_CHECKLIST,
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      completedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];
};

// --- Global Modals ---

const ImageModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-4xl w-full flex justify-center">
        <img src={src} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" alt="Detail" onClick={(e) => e.stopPropagation()} />
        <button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors bg-white/10 p-2 rounded-full">
            <X size={24}/>
        </button>
      </div>
    </div>
  );
};

const InstallGuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-xl font-bold text-slate-800">App Installieren</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
        </div>
        
        <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                Installiere diese App auf deinem Homescreen für Vollbild-Modus und schnelleren Zugriff.
            </div>

            {isIOS ? (
                <div className="space-y-3">
                    <p className="font-semibold text-slate-700">Anleitung für iPhone (Safari):</p>
                    <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                        <li>Tippe unten auf den <span className="font-bold text-blue-600"><Share size={14} className="inline"/> Teilen-Button</span>.</li>
                        <li>Scrolle nach unten und wähle <span className="font-bold">"Zum Home-Bildschirm"</span>.</li>
                        <li>Bestätige mit "Hinzufügen".</li>
                    </ol>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="font-semibold text-slate-700">Anleitung für Android (Chrome):</p>
                    <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                        <li>Tippe oben rechts auf das <span className="font-bold">Drei-Punkte-Menü</span>.</li>
                        <li>Wähle <span className="font-bold">"App installieren"</span> oder "Zum Startbildschirm zufügen".</li>
                        <li>Bestätige die Installation.</li>
                    </ol>
                </div>
            )}
            
            <button onClick={onClose} className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold mt-4">Verstanden</button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function CleanTeamApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [activeStaffProfile, setActiveStaffProfile] = useState(null); 
  
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [properties, setProperties] = useState([]); 
  const [settings, setSettings] = useState({ apiKey: '', corsProxy: 'https://corsproxy.io/?', autoSyncInterval: 0 });
  const [selectedImage, setSelectedImage] = useState(null); 
  const [detailTask, setDetailTask] = useState(null); // Lifted state for global modal
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [uploadingTask, setUploadingTask] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const settingsUnsub = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({...prev, ...data}));
      }
    }, (error) => console.error("Err settings", error));

    const staffUnsub = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'staff'), (snapshot) => {
      const staffList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStaff(staffList);
    }, (error) => console.error("Err staff", error));

    const tasksUnsub = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), (snapshot) => {
      const taskList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(taskList);
      setLoading(false);
    }, (error) => console.error("Err tasks", error));

    const propertiesUnsub = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'properties'), (snapshot) => {
      const propList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setProperties(propList);
    }, (error) => console.error("Err properties", error));

    return () => {
      settingsUnsub();
      staffUnsub();
      tasksUnsub();
      propertiesUnsub();
    };
  }, [user]);

  const handleSaveSettings = async (newSettings) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main'), newSettings);
  };

  const handleAddStaff = async (name) => {
    if (!user || !name) return;
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'staff'), {
      name,
      color: randomColor,
      joined: new Date().toISOString()
    });
  };

  const handleDeleteStaff = async (id) => {
    if(!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'staff', id));
  }

  const handleAssignTask = async (taskId, staffIds) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), {
      assignedTo: staffIds
    });
  };

  const handleTaskStatusChange = async (taskId, newStatus, issueText = null) => {
    if (!user) return;
    const updateData = { status: newStatus };
    const task = tasks.find(t => t.id === taskId);

    if (newStatus === 'in-progress' && !task.startedAt) {
        updateData.startedAt = new Date().toISOString();
    }
    
    if (newStatus === 'completed') {
        updateData.completedAt = new Date().toISOString();
    }

    if (issueText) updateData.issueReport = issueText;
    
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), updateData);
  };

  const handlePhotoUpload = async (taskId, type, file) => {
    if (!user || !file) return;
    setUploadingTask(taskId);
    
    try {
      const compressedBase64 = await compressImage(file);
      const task = tasks.find(t => t.id === taskId);
      const currentPhotos = task.photos || { before: [], after: [] };
      
      const safePhotos = {
          before: Array.isArray(currentPhotos.before) ? currentPhotos.before : [],
          after: Array.isArray(currentPhotos.after) ? currentPhotos.after : []
      };

      const updatedPhotos = {
        ...safePhotos,
        [type]: [...safePhotos[type], compressedBase64]
      };

      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), {
        photos: updatedPhotos
      });
    } catch (err) {
      console.error("Upload failed", err);
    //   alert("Fehler beim Foto-Upload. Bitte erneut versuchen.");
    } finally {
      setUploadingTask(null);
    }
  };

  const syncWithSmoobu = async () => {
    setIsSyncing(true);
    setSyncError(null);
    
    if (!settings.apiKey) {
      setTimeout(async () => {
        const mockTasks = generateMockData();
        for (const task of mockTasks) {
           const existing = tasks.find(t => t.id === task.id);
           if (!existing) {
             await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), task);
           }
        }
        setIsSyncing(false);
      }, 1500);
      return;
    }

    try {
        const fromDate = new Date().toISOString().split('T')[0];
        const toDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]; 
        const endpoint = `https://login.smoobu.com/api/reservations?from=${fromDate}&to=${toDate}&excludeBlocked=true`;
        const proxy = settings.corsProxy || '';
        const url = `${proxy}${endpoint}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Api-Key': settings.apiKey,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const reservations = data.bookings || [];
        let newCount = 0;

        const batch = writeBatch(db);
        const seenProperties = new Set(properties.map(p => p.name));
        
        for (const res of reservations) {
            const cleaningDate = res.departure;
            const taskId = `smoobu-${res.id}`;
            const apartmentName = res.apartment ? res.apartment.name : `Apt ID ${res.apartmentId}`;
            
            if (!seenProperties.has(apartmentName)) {
                const propRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'properties'));
                batch.set(propRef, { 
                    name: apartmentName, 
                    lat: null, 
                    lng: null,
                    defaultStaff: [], 
                    checklist: DEFAULT_CHECKLIST
                });
                seenProperties.add(apartmentName);
            }

            const existing = tasks.find(t => t.id === taskId);
            const propConfig = properties.find(p => p.name === apartmentName);
            const defaultStaff = propConfig ? (propConfig.defaultStaff || []) : [];
            const defaultChecklist = propConfig ? (propConfig.checklist || DEFAULT_CHECKLIST) : DEFAULT_CHECKLIST;

            if (!existing) {
                const newTask = {
                    id: taskId,
                    apartment: apartmentName,
                    date: cleaningDate,
                    status: 'pending',
                    guestName: res.guestName || 'Gast',
                    notes: res.notice || '',
                    assignedTo: defaultStaff,
                    checklist: defaultChecklist,
                    source: 'smoobu',
                    photos: { before: [], after: [] },
                    liveStatus: 'unknown',
                    originalData: res
                };
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), newTask);
                newCount++;
            } else {
                if (existing.status === 'pending') {
                     await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), {
                          guestName: res.guestName || existing.guestName,
                          notes: res.notice || existing.notes,
                          date: res.departure
                      });
                }
            }
        }
        await batch.commit();
        
        if (newCount === 0 && reservations.length > 0) {
             setSyncError("Sync erfolgreich, aber keine neuen Abreisen gefunden.");
        }

    } catch (error) {
        console.error("Smoobu Sync Failed:", error);
        setSyncError(`Fehler beim Sync: ${error.message}. Prüfe Proxy & API Key.`);
    } finally {
        setIsSyncing(false);
    }
  };

  // --- Auto-Sync Logic ---
  const syncRef = useRef(syncWithSmoobu);
  useEffect(() => { syncRef.current = syncWithSmoobu; }); // Always keep ref current

  useEffect(() => {
      const intervalMinutes = parseInt(settings.autoSyncInterval || 0);
      if (intervalMinutes > 0 && settings.apiKey) {
          const intervalId = setInterval(() => {
              if (!isSyncing) {
                  console.log("Auto-Sync triggered...");
                  syncRef.current();
              }
          }, intervalMinutes * 60000);
          return () => clearInterval(intervalId);
      }
  }, [settings.autoSyncInterval, settings.apiKey]);

  const clearAllTasks = async () => {
      if(!user) return;
      tasks.forEach(async (t) => {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', t.id));
      });
  }

  const filteredTasks = useMemo(() => {
    if (activeStaffProfile) {
      return tasks.filter(t => {
          if (Array.isArray(t.assignedTo)) {
              return t.assignedTo.includes(activeStaffProfile.id);
          }
          return t.assignedTo === activeStaffProfile.id;
      });
    }
    return tasks;
  }, [tasks, activeStaffProfile]);

  // --- Shared Task Detail Modal ---
  const TaskDetailModal = ({ task, onClose }) => {
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    if (!task) return null;
    
    const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
    const photos = task.photos || { before: [], after: [] };
    const duration = calculateDuration(task.startedAt, task.completedAt || task.autoLeftAt);

    const toggleAssignment = (staffId) => {
        let newIds = [...assignedIds];
        if (newIds.includes(staffId)) {
            newIds = newIds.filter(id => id !== staffId);
        } else {
            newIds.push(staffId);
        }
        handleAssignTask(task.id, newIds);
    };

    const handleAnalyzeIssue = async () => {
        setIsAnalyzing(true);
        setAiAnalysis(null);
        const prompt = `
            Du bist ein intelligenter Assistent für eine Reinigungsfirma.
            Kontext: Apartment: ${task.apartment}, Gast: ${task.guestName}, Notiz: "${task.notes || 'Keine'}", Problem: "${task.issueReport || 'Keine'}"
            Aufgabe: Analysiere Handlungsbedarf und entwirf eine Nachricht an den Gast (auf Deutsch).
            Formatierung: Nutze Markdown.
        `;
        const result = await callGeminiAI(prompt);
        setAiAnalysis(result);
        setIsAnalyzing(false);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
                    <div><h3 className="text-xl font-bold text-slate-800 leading-tight">{task.apartment}</h3><div className="flex items-center gap-2 text-slate-500 mt-1"><Calendar size={14} /> <span>{formatDate(task.date)}</span></div></div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={24}/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-100"><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Status</p><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-bold ${task.status === 'completed' ? 'bg-green-100 text-green-700' : task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-600'}`}>{task.status === 'completed' && <CheckCircle size={14}/>}{task.status === 'pending' ? 'Offen' : task.status === 'in-progress' ? 'In Arbeit' : 'Erledigt'}</span></div>
                        <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-100"><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Gast</p><div className="font-medium text-slate-800 flex items-center gap-2"><User size={16} className="text-slate-400"/> {task.guestName}</div></div>
                    </div>
                    {task.startedAt && (<div className="p-4 bg-blue-50 rounded-lg border border-blue-100"><h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2"><Clock size={16}/> Zeiterfassung</h4><div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-blue-400 text-xs">Start</p><p className="font-mono text-blue-800">{formatTime(task.startedAt)}</p></div><div><p className="text-blue-400 text-xs">Ende</p><p className="font-mono text-blue-800">{formatTime(task.completedAt || task.autoLeftAt)} {task.autoLeftAt && !task.completedAt ? '(Auto)' : ''}</p></div></div>{duration && <div className="mt-2 pt-2 border-t border-blue-100 text-center font-bold text-blue-800">Dauer: {duration}</div>}</div>)}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Users size={18} className="text-slate-400"/> Zuständiges Personal</h4><div className="flex flex-wrap gap-2 mb-2">{staff.map(s => { const isAssigned = assignedIds.includes(s.id); return (<button key={s.id} onClick={() => toggleAssignment(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${isAssigned ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}><div className={`w-4 h-4 rounded-full ${s.color} border border-white`}></div>{s.name}{isAssigned && <Check size={14} />}</button>)})}{staff.length === 0 && <p className="text-xs text-slate-400 italic">Kein Personal angelegt.</p>}</div><p className="text-xs text-slate-400">Klicke auf Namen um sie zuzuweisen oder zu entfernen.</p></div>
                    {(task.notes || task.issueReport) && (<div className="space-y-3">{task.notes && (<div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-yellow-800 text-sm"><strong>📝 Hinweis:</strong> {task.notes}</div>)}{task.issueReport && (<div className="bg-red-50 p-4 rounded-lg border border-red-100 text-red-800 text-sm"><strong>⚠️ Problem gemeldet:</strong> {task.issueReport}</div>)}<button onClick={handleAnalyzeIssue} disabled={isAnalyzing} className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 shadow-sm">{isAnalyzing ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>}{isAnalyzing ? 'Analysiere...' : 'KI-Hilfe & Antwortvorschlag'}</button>{aiAnalysis && (<div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap animate-in fade-in slide-in-from-top-2"><div className="font-bold text-violet-600 mb-2 flex items-center gap-2"><MessageSquare size={16}/> KI-Vorschlag:</div>{aiAnalysis}</div>)}</div>)}
                    {(photos.before?.length > 0 || photos.after?.length > 0) && (<div><h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><ImageIcon size={18} className="text-slate-400"/> Fotodokumentation</h4>{photos.before?.length > 0 && (<div className="mb-4"><p className="text-xs font-semibold text-slate-500 uppercase mb-2">Vorher</p><div className="flex gap-2 overflow-x-auto pb-2">{photos.before.map((src, i) => (<img key={i} src={src} onClick={() => setSelectedImage(src)} className="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-zoom-in hover:opacity-90" alt="Vorher"/>))}</div></div>)}{photos.after?.length > 0 && (<div><p className="text-xs font-semibold text-slate-500 uppercase mb-2">Nachher</p><div className="flex gap-2 overflow-x-auto pb-2">{photos.after.map((src, i) => (<img key={i} src={src} onClick={() => setSelectedImage(src)} className="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-zoom-in hover:opacity-90" alt="Nachher"/>))}</div></div>)}</div>)}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center"><button onClick={onClose} className="text-slate-500 hover:text-slate-800 font-medium text-sm">Schließen</button></div>
            </div>
        </div>
    );
  };

  // --- Views ---

  const DashboardView = () => {
    return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800">Einsatzplanung</h2><p className="text-slate-500">Übersicht aller Check-outs und Reinigungen</p></div>
        <div className="flex gap-2">
             <button onClick={clearAllTasks} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-2"><LogOut size={18} /> <span>Liste Leeren</span></button>
          <button onClick={syncWithSmoobu} disabled={isSyncing} className={`px-4 py-2 ${syncError ? 'bg-red-600' : 'bg-emerald-600'} text-white rounded-lg hover:brightness-110 transition-colors flex items-center gap-2 shadow-sm`}><RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} /> <span>{isSyncing ? 'Lade Daten...' : 'Sync Smoobu'}</span></button>
        </div>
      </div>
      {syncError && (<div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2"><AlertTriangle size={16} /> {syncError}</div>)}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"><div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Brush size={24} /></div><div><p className="text-sm text-slate-500">Offen</p><p className="text-2xl font-bold text-slate-800">{tasks.filter(t => t.status === 'pending').length}</p></div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"><div className="p-3 bg-yellow-100 text-yellow-600 rounded-full"><RefreshCw size={24} /></div><div><p className="text-sm text-slate-500">In Arbeit</p><p className="text-2xl font-bold text-slate-800">{tasks.filter(t => t.status === 'in-progress').length}</p></div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"><div className="p-3 bg-green-100 text-green-600 rounded-full"><CheckCircle size={24} /></div><div><p className="text-sm text-slate-500">Erledigt</p><p className="text-2xl font-bold text-slate-800">{tasks.filter(t => t.status === 'completed').length}</p></div></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-semibold text-slate-800">Aktuelle Aufgaben</h3></div>
        <div className="divide-y divide-slate-100">
          {tasks.length === 0 ? <div className="p-8 text-center text-slate-500">Keine Reinigungsaufgaben gefunden. Klicke auf "Sync Smoobu".</div> : (
            tasks.map(task => {
                const photos = task.photos || { before: [], after: [] };
                const hasPhotos = (photos.before?.length > 0) || (photos.after?.length > 0);
                const isLive = task.liveStatus === 'on-site';
                const duration = calculateDuration(task.startedAt, task.completedAt || task.autoLeftAt);
                const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                return (
                  <div key={task.id} onClick={() => setDetailTask(task)} className="p-4 flex flex-col hover:bg-slate-50 transition-colors cursor-pointer group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                        <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${task.status === 'completed' ? 'bg-green-500' : task.status === 'in-progress' ? 'bg-yellow-500' : 'bg-slate-300'}`} />
                        <div>
                            <h4 className="font-semibold text-slate-800 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                                {task.apartment}
                                {hasPhotos && <Camera size={16} className="text-blue-500" />}
                                {isLive && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><MapPin size={10}/> Vor Ort</span>}
                            </h4>
                            <div className="flex flex-wrap gap-2 text-sm text-slate-500 mt-1"><span className="flex items-center gap-1"><Calendar size={14}/> {formatDate(task.date)}</span><span className="flex items-center gap-1"><User size={14}/> {task.guestName}</span></div>
                            {task.startedAt && (<div className="flex items-center gap-2 mt-2 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit"><Clock size={12} /><span>{formatTime(task.startedAt)} - {formatTime(task.completedAt || task.autoLeftAt)}</span>{duration && <span className="font-bold text-slate-800">({duration})</span>}{task.autoLeftAt && !task.completedAt && <span className="text-orange-500" title="Auto-Log durch GPS">(Auto-Exit)</span>}</div>)}
                            {task.notes && <div className="mt-2 text-sm bg-yellow-50 text-yellow-800 px-2 py-1 rounded inline-block">Hinweis: {task.notes}</div>}
                            {task.issueReport && <div className="mt-2 text-sm bg-red-50 text-red-800 px-2 py-1 rounded flex items-center gap-1"><AlertTriangle size={14} /> Problem: {task.issueReport}</div>}
                        </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex -space-x-2">{assignedIds.map(sid => {const member = staff.find(s => s.id === sid);if (!member) return null;return (<div key={sid} title={member.name} className={`w-8 h-8 rounded-full border-2 border-white ${member.color} flex items-center justify-center text-white text-xs font-bold`}>{member.name.charAt(0)}</div>);})}{assignedIds.length === 0 && <span className="text-slate-400 text-xs italic">Unzugewiesen</span>}</div>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${task.status === 'completed' ? 'bg-green-100 text-green-700' : task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>{task.status === 'pending' ? 'Offen' : task.status === 'in-progress' ? 'Läuft' : 'Fertig'}</div>
                        </div>
                    </div>
                  </div>
                );
            })
          )}
        </div>
      </div>
    </div>
    );
  };

  const CalendarView = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    const days = [];
    for (let i = 0; i < startDayOffset; i++) { days.push(null); }
    for (let i = 1; i <= daysInMonth; i++) { days.push(new Date(year, month, i)); }
    const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(currentMonth);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h2 className="text-2xl font-bold text-slate-800">Kalenderübersicht</h2><p className="text-slate-500">Reinigungsplan für {monthName}</p></div>
                <div className="flex gap-2 bg-white rounded-lg shadow-sm p-1 border border-slate-200"><button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-md text-slate-600"><ChevronLeft size={20}/></button><span className="px-4 py-2 font-semibold text-slate-700 min-w-[150px] text-center">{monthName}</span><button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-md text-slate-600"><ChevronRight size={20}/></button></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (<div key={day} className="py-3 text-center text-sm font-semibold text-slate-600">{day}</div>))}</div>
                <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-[1px]">
                    {days.map((date, idx) => {
                        if (!date) return <div key={`pad-${idx}`} className="bg-white min-h-[120px]"></div>;
                        const dateStr = date.toISOString().split('T')[0];
                        const dayTasks = tasks.filter(t => t.date === dateStr);
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        return (
                            <div key={idx} className={`bg-white min-h-[120px] p-2 hover:bg-blue-50/30 transition-colors ${isToday ? 'bg-blue-50' : ''}`}>
                                <div className="flex justify-between items-start mb-2"><span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>{date.getDate()}</span>{dayTasks.length > 0 && (<span className="text-xs text-slate-400">{dayTasks.length} {dayTasks.length === 1 ? 'Job' : 'Jobs'}</span>)}</div>
                                <div className="space-y-1">{dayTasks.map(task => { const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []); const firstStaff = staff.find(s => s.id === assignedIds[0]); const borderColor = firstStaff ? firstStaff.color.replace('bg-', 'border-') : 'border-slate-400'; return (<div key={task.id} onClick={() => setDetailTask(task)} className={`text-[10px] p-1.5 rounded border-l-4 truncate cursor-pointer shadow-sm hover:brightness-95 transition-all active:scale-95 ${task.status === 'completed' ? 'bg-green-50 border-green-500 text-green-700 opacity-70' : (firstStaff ? `bg-white ${borderColor} text-slate-700` : 'bg-slate-50 border-slate-400 text-slate-500')}`} title="Details ansehen" style={firstStaff ? { borderLeftColor: 'inherit' } : {}}>{task.status === 'completed' && '✅ '}{task.apartment}</div>);})}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="flex gap-4 text-sm text-slate-500 mt-4 px-2"><div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-200 border-l-4 border-slate-400 rounded"></div> Offen / Nicht zugewiesen</div><div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border-l-4 border-blue-400 rounded shadow-sm"></div> Zugewiesen</div><div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-50 border-l-4 border-green-500 rounded"></div> Erledigt</div></div>
        </div>
    );
  };

  const StaffManagementView = () => {
    const [newName, setNewName] = useState('');
    return (
      <div className="space-y-6 max-w-4xl">
        <div><h2 className="text-2xl font-bold text-slate-800">Team Verwaltung</h2><p className="text-slate-500">Profile für Reinigungskräfte erstellen</p></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex gap-4 items-end mb-8">
            <div className="flex-1"><label className="block text-sm font-medium text-slate-700 mb-1">Neues Profil Name</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z.B. Maria Muster" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
            <button onClick={() => { handleAddStaff(newName); setNewName(''); }} disabled={!newName} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Plus size={20} /> Hinzufügen</button>
          </div>
          <h3 className="font-semibold text-slate-800 mb-4">Aktuelles Team</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staff.map(member => (
              <div key={member.id} className="p-4 border border-slate-200 rounded-lg flex items-center justify-between group hover:border-emerald-300 transition-colors">
                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full ${member.color} flex items-center justify-center text-white font-bold`}>{member.name.charAt(0)}</div><div><p className="font-medium text-slate-800">{member.name}</p><p className="text-xs text-slate-400">ID: {member.id.substring(0,6)}</p></div></div>
                <button onClick={() => handleDeleteStaff(member.id)} className="text-slate-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><X size={20} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const PropertiesView = () => {
    const [editingProp, setEditingProp] = useState(null);
    const [editChecklistInput, setEditChecklistInput] = useState('');
    const [showUpdateConfirm, setShowUpdateConfirm] = useState(false); // Custom Modal State
    const [generatingChecklist, setGeneratingChecklist] = useState(false);

    // --- Gemini Feature 2: Checklist Generation ---
    const handleGenerateChecklist = async () => {
        if (!editingProp?.name) return;
        setGeneratingChecklist(true);
        const prompt = `
            Erstelle eine kurze, professionelle Reinigungs-Checkliste (max 6 Punkte) für eine Ferienwohnung/Apartment mit dem Namen "${editingProp.name}".
            Wichtig: Antworte NUR mit den Listenpunkten, getrennt durch Zeilenumbrüche. Keine Nummerierung, keine Einleitung.
            Beispiel Format:
            Bettwäsche wechseln
            Küche reinigen
            ...
        `;
        const result = await callGeminiAI(prompt);
        // Split by new line and filter empty
        const newItems = result.split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(l => l.length > 2);
        
        if (newItems.length > 0) {
            setEditingProp(prev => ({ ...prev, checklist: newItems }));
        } else {
            alert("Konnte keine Liste generieren.");
        }
        setGeneratingChecklist(false);
    };

    const handleSaveProperty = async (prop) => {
        if (!user) return;
        
        // 1. Save config immediately
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'properties', prop.id), {
            lat: prop.lat,
            lng: prop.lng,
            defaultStaff: prop.defaultStaff || [],
            checklist: prop.checklist || DEFAULT_CHECKLIST
        });
        
        // 2. Check for pending tasks to update
        const pendingTasks = tasks.filter(t => t.apartment === prop.name && t.status === 'pending');
        
        if (pendingTasks.length > 0) {
            setShowUpdateConfirm(true); // Show custom modal
        } else {
            setEditingProp(null);
        }
    };

    const confirmBatchUpdate = async () => {
         if (!editingProp) return;
         const pendingTasks = tasks.filter(t => t.apartment === editingProp.name && t.status === 'pending');
         const batch = writeBatch(db);
         pendingTasks.forEach(t => {
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', t.id);
            batch.update(ref, {
                checklist: editingProp.checklist || DEFAULT_CHECKLIST,
                assignedTo: editingProp.defaultStaff || []
            });
         });
         await batch.commit();
         setShowUpdateConfirm(false);
         setEditingProp(null);
    };

    const cancelBatchUpdate = () => {
        setShowUpdateConfirm(false);
        setEditingProp(null);
    };

    const toggleStaffSelection = (staffId) => {
        if (!editingProp) return;
        const current = editingProp.defaultStaff || [];
        if (current.includes(staffId)) {
            setEditingProp({ ...editingProp, defaultStaff: current.filter(id => id !== staffId) });
        } else {
            setEditingProp({ ...editingProp, defaultStaff: [...current, staffId] });
        }
    };

    const addChecklistItem = () => {
        if (!editChecklistInput.trim()) return;
        setEditingProp({ 
            ...editingProp, 
            checklist: [...(editingProp.checklist || []), editChecklistInput.trim()] 
        });
        setEditChecklistInput('');
    };

    const removeChecklistItem = (idx) => {
        const newList = [...(editingProp.checklist || [])];
        newList.splice(idx, 1);
        setEditingProp({ ...editingProp, checklist: newList });
    };

    const getCurrentLocationForEdit = () => {
        if (!navigator.geolocation) return alert("Geolocation nicht unterstützt.");
        navigator.geolocation.getCurrentPosition(
            (pos) => setEditingProp({...editingProp, lat: pos.coords.latitude, lng: pos.coords.longitude}),
            (err) => alert("Fehler: " + err.message)
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Objektverwaltung</h2>
                <p className="text-slate-500">Stamm-Personal und individuelle Checklisten konfigurieren</p>
            </div>

            {/* Custom Modal for Batch Update */}
            {showUpdateConfirm && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Einstellungen gespeichert</h3>
                        <p className="text-slate-600 mb-6">Möchtest du diese Änderungen (neues Team & Checkliste) auch auf alle aktuell <strong>offenen Aufgaben</strong> für dieses Objekt übertragen?</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={confirmBatchUpdate} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">Ja, Aufgaben aktualisieren</button>
                            <button onClick={cancelBatchUpdate} className="w-full py-3 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200">Nein, nur Standard ändern</button>
                        </div>
                    </div>
                </div>
            )}

            {editingProp ? (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-800">{editingProp.name} Bearbeiten</h3>
                        <button onClick={() => setEditingProp(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Users size={18}/> Stamm-Team zuweisen</h4>
                            <p className="text-xs text-slate-500 mb-3">Diese Mitarbeiter werden bei neuen Buchungen automatisch eingeteilt.</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-100 rounded-lg p-2">
                                {staff.map(s => (
                                    <div 
                                        key={s.id} 
                                        onClick={() => toggleStaffSelection(s.id)}
                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer border transition-colors ${editingProp.defaultStaff?.includes(s.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center text-white font-bold text-xs`}>
                                            {editingProp.defaultStaff?.includes(s.id) && <CheckCircle size={14} />}
                                        </div>
                                        <span className="text-sm font-medium text-slate-700">{s.name}</span>
                                    </div>
                                ))}
                                {staff.length === 0 && <p className="text-sm text-slate-400 italic">Kein Personal vorhanden.</p>}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-slate-700 flex items-center gap-2"><ListChecks size={18}/> Checkliste</h4>
                                <button 
                                    onClick={handleGenerateChecklist}
                                    disabled={generatingChecklist}
                                    className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-md hover:bg-violet-200 flex items-center gap-1 transition-colors"
                                    title="Automatisch generieren mit AI"
                                >
                                    {generatingChecklist ? <RefreshCw className="animate-spin" size={12}/> : <Wand2 size={12}/>}
                                    Auto-Liste
                                </button>
                            </div>
                            
                            <div className="flex gap-2 mb-3">
                                <input 
                                    type="text" 
                                    value={editChecklistInput} 
                                    onChange={(e) => setEditChecklistInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                                    placeholder="Neue Aufgabe..." 
                                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button onClick={addChecklistItem} className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200"><Plus size={20}/></button>
                            </div>
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                                {(editingProp.checklist || []).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded group">
                                        <span className="text-sm text-slate-700">{item}</span>
                                        <button onClick={() => removeChecklistItem(idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                {(!editingProp.checklist || editingProp.checklist.length === 0) && <p className="text-xs text-slate-400 italic">Standard-Liste wird verwendet.</p>}
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><MapPin size={18}/> Standort (GPS)</h4>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 block mb-1">Breitengrad (Lat)</label>
                                    <input 
                                        type="number" step="any"
                                        value={editingProp.lat || ''}
                                        onChange={(e) => setEditingProp({...editingProp, lat: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 block mb-1">Längengrad (Lng)</label>
                                    <input 
                                        type="number" step="any"
                                        value={editingProp.lng || ''}
                                        onChange={(e) => setEditingProp({...editingProp, lng: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                                    />
                                </div>
                                <button 
                                    onClick={getCurrentLocationForEdit} 
                                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 text-sm font-medium flex items-center gap-2 mb-[1px]"
                                >
                                    <Navigation size={16}/> Aktuelle Position
                                </button>
                            </div>
                            {editingProp.lat && (
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${editingProp.lat},${editingProp.lng}`} 
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline mt-2 inline-block flex items-center gap-1"
                                >
                                    Auf Karte prüfen <ExternalLink size={10}/>
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end gap-3">
                        <button onClick={() => setEditingProp(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Abbrechen</button>
                        <button onClick={() => handleSaveProperty(editingProp)} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2"><Save size={18}/> Speichern</button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-4">Objektname</th>
                                <th className="p-4">Team (Standard)</th>
                                <th className="p-4">Standort</th>
                                <th className="p-4 text-right">Aktion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {properties.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-slate-400 italic">Keine Objekte. Sync Smoobu...</td></tr>}
                            {properties.map(prop => (
                                <tr key={prop.id} className="hover:bg-slate-50 group">
                                    <td className="p-4 font-medium text-slate-800">{prop.name}</td>
                                    <td className="p-4">
                                        <div className="flex -space-x-2">
                                            {(prop.defaultStaff || []).map(sid => {
                                                const member = staff.find(s => s.id === sid);
                                                if (!member) return null;
                                                return (
                                                    <div key={sid} title={member.name} className={`w-8 h-8 rounded-full border-2 border-white ${member.color} flex items-center justify-center text-white text-xs font-bold`}>
                                                        {member.name.charAt(0)}
                                                    </div>
                                                );
                                            })}
                                            {(!prop.defaultStaff || prop.defaultStaff.length === 0) && <span className="text-slate-400 italic text-xs">Kein Team</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        {prop.lat ? (
                                            <span className="text-emerald-600 flex items-center gap-1"><MapPin size={12}/> Gesetzt</span>
                                        ) : (
                                            <span className="text-orange-400 flex items-center gap-1"><AlertTriangle size={12}/> Fehlt</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => setEditingProp(prop)}
                                            className="bg-white border border-slate-200 text-slate-600 p-2 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                        >
                                            <Edit size={16}/> Bearbeiten
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
  };

  const SettingsView = () => (
    <div className="space-y-6 max-w-2xl">
      <div><h2 className="text-2xl font-bold text-slate-800">Einstellungen</h2><p className="text-slate-500">Verbindung zu Smoobu & System</p></div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Smoobu API Key</label><input type="password" value={settings.apiKey || ''} onChange={(e) => setSettings({...settings, apiKey: e.target.value})} placeholder="Dein API Key von Smoobu..." className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">CORS Proxy URL (Optional)</label><div className="flex items-center gap-2"><Server size={18} className="text-slate-400"/><input type="text" value={settings.corsProxy || ''} onChange={(e) => setSettings({...settings, corsProxy: e.target.value})} placeholder="z.B. https://corsproxy.io/?" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div></div>
        
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Automatische Synchronisierung (Minuten)</label>
            <div className="flex items-center gap-2">
                <Clock size={18} className="text-slate-400"/>
                <input 
                    type="number" 
                    min="0"
                    value={settings.autoSyncInterval || ''} 
                    onChange={(e) => setSettings({...settings, autoSyncInterval: parseInt(e.target.value) || 0})} 
                    placeholder="0 = Deaktiviert" 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                />
            </div>
            <p className="text-xs text-slate-500 mt-1">Stelle 0 ein, um den Auto-Sync zu deaktivieren.</p>
        </div>

        <div className="pt-4 flex justify-end"><button onClick={() => handleSaveSettings(settings)} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900">Speichern</button></div>
      </div>
    </div>
  );

  // --- Staff View (Mobile Optimized) ---

  const StaffMobileView = () => {
    if (!activeStaffProfile) return null;

    const myTasks = tasks.filter(t => {
        if (Array.isArray(t.assignedTo)) {
            return t.assignedTo.includes(activeStaffProfile.id);
        }
        return t.assignedTo === activeStaffProfile.id;
    });

    // Location Tracking Logic Component (Invisible)
    const LocationTracker = ({ task }) => {
        useEffect(() => {
            // Find property geo data
            const prop = properties.find(p => p.name === task.apartment);
            if (!prop || !prop.lat) return;

            const watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const dist = getDistanceFromLatLonInKm(pos.coords.latitude, pos.coords.longitude, prop.lat, prop.lng);
                    const isNear = dist < 0.2; // 200m radius
                    const newStatus = isNear ? 'on-site' : 'away';
                    
                    if (task.liveStatus !== newStatus) {
                         const updatePayload = { liveStatus: newStatus };
                         if (newStatus === 'away' && task.status === 'in-progress') {
                             updatePayload.autoLeftAt = new Date().toISOString();
                         }
                         updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), updatePayload);
                    }
                },
                (err) => console.warn("GPS Error", err),
                { enableHighAccuracy: true }
            );
            return () => navigator.geolocation.clearWatch(watchId);
        }, [task.id, task.apartment, task.liveStatus, task.status]); 

        return null;
    };

    const PhotoSection = ({ title, type, task, icon }) => {
        const photos = task.photos?.[type] || [];
        const isUploading = uploadingTask === task.id;

        return (
            <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">{icon} {title}</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                    {photos.map((src, idx) => (
                        <img key={idx} src={src} className="w-16 h-16 object-cover rounded border border-slate-200" alt={type} onClick={() => setSelectedImage(src)}/>
                    ))}
                    <label className={`w-16 h-16 flex items-center justify-center border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                        <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={(e) => handlePhotoUpload(task.id, type, e.target.files[0])} />
                        {isUploading ? <RefreshCw className="animate-spin text-slate-400" size={20}/> : <Camera className="text-slate-400" size={20} />}
                    </label>
                </div>
            </div>
        );
    };

    return (
      <div className="min-h-screen bg-slate-100 pb-20">
        <div className={`p-6 ${activeStaffProfile.color} text-white shadow-lg rounded-b-3xl mb-6`}>
          <div className="flex justify-between items-start">
            <div><p className="text-blue-100 text-sm mb-1">Hallo,</p><h1 className="text-3xl font-bold">{activeStaffProfile.name}</h1></div>
            <button onClick={() => { setActiveStaffProfile(null); setView('dashboard'); }} className="bg-white/20 p-2 rounded-lg backdrop-blur-sm hover:bg-white/30"><LogOut size={20} /></button>
          </div>
          <div className="mt-6 flex gap-4">
            <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm"><p className="text-2xl font-bold">{myTasks.filter(t => t.status === 'pending').length}</p><p className="text-xs text-blue-100">Offen</p></div>
            <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm"><p className="text-2xl font-bold">{myTasks.filter(t => t.status === 'completed').length}</p><p className="text-xs text-blue-100">Fertig</p></div>
          </div>
        </div>

        <div className="px-4 mb-4"><button onClick={() => setShowInstallGuide(true)} className="w-full flex items-center justify-center gap-2 bg-white p-3 rounded-xl text-sm font-medium text-slate-600 shadow-sm border border-slate-100"><HelpCircle size={16} className="text-blue-500" /> Wie installiere ich die App?</button></div>

        <div className="px-4 space-y-4">
          <h2 className="font-bold text-slate-700 ml-1">Deine Aufgaben heute</h2>
          {myTasks.length === 0 ? <div className="bg-white p-8 rounded-2xl text-center shadow-sm"><CheckCircle size={32} className="mx-auto text-green-500 mb-3" /><h3 className="font-bold text-slate-800">Alles erledigt!</h3></div> : (
            myTasks.map(task => (
              <div key={task.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                {/* Activate Tracker for this task */}
                <LocationTracker task={task} />
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{task.status === 'pending' ? 'To Do' : task.status === 'in-progress' ? 'In Arbeit' : 'Fertig'}</span>
                    <span className="text-sm text-slate-400">{formatDate(task.date)}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">{task.apartment}</h3>
                  <p className="text-sm text-slate-500 mb-4">Gast: {task.guestName}</p>
                  
                  {task.liveStatus === 'on-site' && (
                      <div className="mb-4 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 border border-green-200">
                          <MapPin size={16} /> Du bist am Standort!
                      </div>
                  )}

                  {task.notes && <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-4"><strong>Notiz:</strong> {task.notes}</div>}

                  {task.status !== 'completed' && (
                    <div className="space-y-4 mb-6 border-t border-slate-100 pt-4">
                        <PhotoSection title="Vorher-Fotos (Schäden?)" type="before" task={task} icon={<AlertTriangle size={16} className="text-orange-500"/>} />
                        {(task.status === 'in-progress') && <PhotoSection title="Nachher-Fotos (Fertig)" type="after" task={task} icon={<CheckCircle size={16} className="text-green-500"/>} />}
                        
                        {/* DYNAMIC CHECKLIST */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Checkliste für dieses Objekt</p>
                            {(task.checklist || DEFAULT_CHECKLIST).map((item, idx) => (
                                <label key={idx} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input type="checkbox" className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" />
                                    <span className="text-slate-700 text-sm">{item}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    {task.status === 'pending' && <button onClick={() => handleTaskStatusChange(task.id, 'in-progress')} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold shadow-blue-200 shadow-lg active:scale-95 transition-transform">Reinigung starten</button>}
                    {task.status === 'in-progress' && (
                      <>
                        <button onClick={() => { const issue = prompt("Welches Problem gibt es?"); if(issue) handleTaskStatusChange(task.id, 'in-progress', issue); }} className="px-4 bg-red-100 text-red-600 rounded-xl font-medium"><AlertTriangle size={20} /></button>
                        <button onClick={() => handleTaskStatusChange(task.id, 'completed')} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold shadow-emerald-200 shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"><CheckCircle size={20} /> Abschließen</button>
                      </>
                    )}
                    {task.status === 'completed' && <div className="w-full text-center py-2 text-green-600 font-medium bg-green-50 rounded-lg">Reinigung abgeschlossen ✅</div>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const Sidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-xl`}>
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brush className="text-emerald-400" />
          CleanTeam
        </h1>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden">
          <X size={24} />
        </button>
      </div>

      <nav className="mt-6 px-4 space-y-2">
        <button onClick={() => { setView('dashboard'); setActiveStaffProfile(null); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
          <Home size={20} /> <span>Einsatzplan</span>
        </button>
        <button onClick={() => { setView('calendar'); setActiveStaffProfile(null); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'calendar' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
          <Calendar size={20} /> <span>Monatskalender</span>
        </button>
        <button onClick={() => { setView('properties'); setActiveStaffProfile(null); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'properties' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
          <MapPin size={20} /> <span>Objekte & Teams</span>
        </button>
        <button onClick={() => { setView('staff'); setActiveStaffProfile(null); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'staff' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
          <Users size={20} /> <span>Team & Personal</span>
        </button>
        <button onClick={() => { setView('settings'); setActiveStaffProfile(null); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'settings' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
          <Settings size={20} /> <span>Einstellungen (API)</span>
        </button>
      </nav>

      <div className="absolute bottom-0 w-full p-4 bg-slate-800">
        <button onClick={() => setShowInstallGuide(true)} className="w-full mb-4 flex items-center justify-center gap-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded transition-colors">
          <Download size={14} /> App Installieren (Hilfe)
        </button>
        <p className="text-xs text-slate-400 mb-2 font-semibold uppercase">Reinigungskraft Ansicht</p>
        <div className="space-y-2">
          {staff.length === 0 && <p className="text-xs text-slate-500 italic">Kein Personal angelegt</p>}
          {staff.map(member => (
            <button key={member.id} onClick={() => { setActiveStaffProfile(member); setView('staff-view'); setSidebarOpen(false); }} className="w-full flex items-center gap-2 text-sm text-slate-300 hover:text-white p-2 hover:bg-slate-700 rounded">
              <div className={`w-2 h-2 rounded-full ${member.color}`}></div> {member.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Lade CleanTeam...</div>;

  if (view === 'staff-view') return (
    <>
        <StaffMobileView />
        <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="md:hidden bg-white p-4 flex items-center justify-between border-b border-slate-200 shadow-sm">
            <h1 className="font-bold text-lg flex items-center gap-2"><Brush className="text-emerald-500"/> CleanTeam</h1>
            <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600"><Menu size={24} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {view === 'dashboard' && <DashboardView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'properties' && <PropertiesView />}
            {view === 'staff' && <StaffManagementView />}
            {view === 'settings' && <SettingsView />}
          </div>
        </div>
      </main>
      
      {/* GLOBAL MODALS */}
      <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />
    </div>
  );
}