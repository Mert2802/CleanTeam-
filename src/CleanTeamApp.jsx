import React, { useEffect, useState } from "react";
import { db, appId } from "./firebase";
import { signOut } from "./auth/authService";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import TeamView from "./components/views/Team";
import SettingsView from "./components/views/Settings";
import CalendarView from "./components/views/CalendarView";
import PropertiesView from "./components/views/PropertiesView";
import TeamChat from "./components/TeamChat";
import {
  AlertTriangle,
  Brush,
  Camera,
  Calendar,
  CheckCircle,
  Home,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";

// HINWEIS: Viele UI-Komponenten (Views, Modals) sind hier vorerst als Platzhalter
// oder vereinfachte Versionen belassen. Sie werden in den nächsten Schritten
// in eigene Dateien ausgelagert und vervollständigt.

/* ---------------- Haupt-App-Komponente ---------------- */

export default function CleanTeamApp({ authUser }) {
  const [loading, setLoading] = useState(true);
  const { teamId, role } = authUser;

  // States für die Team-Daten
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [properties, setProperties] = useState([]);
  const [appSettings, setAppSettings] = useState(null);

  // UI-States
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingTask, setUploadingTask] = useState(null);

  // Effekt für Firestore-Subscriptions basierend auf der Team-ID
  useEffect(() => {
    if (!teamId) {
        setLoading(false);
        return;
    }
    
    console.log(`Initialisiere Listener für Team-ID: ${teamId}`);
    setLoading(true);
    const base = ["artifacts", appId, "teams", teamId];

    const unsubSettings = onSnapshot(doc(db, ...base, "config", "main"), (snap) => {
      if (snap.exists()) setAppSettings(snap.data());
    });

    const unsubStaff = onSnapshot(collection(db, `artifacts/${appId}/teams/${teamId}/members`), (snap) => {
      const staffMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStaff(staffMembers);
    });

    const unsubProperties = onSnapshot(collection(db, ...base, "properties"), (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubTasks = onSnapshot(collection(db, ...base, "tasks"), (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Fehler beim Laden der Aufgaben:", err);
      setLoading(false);
    });

    return () => {
      unsubSettings();
      unsubStaff();
      unsubProperties();
      unsubTasks();
    };
  }, [teamId]); // Dieser Effekt reagiert jetzt auf die Änderung der teamId.

  const handleTaskStatusChange = async (taskId, newStatus, issueText = null) => {
    if (!teamId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updateData = { status: newStatus };
    if (newStatus === "in-progress" && !task.startedAt) {
      updateData.startedAt = new Date().toISOString();
    }
    if (newStatus === "completed") {
      updateData.completedAt = new Date().toISOString();
    }
    if (issueText) updateData.issueReport = issueText;

    await updateDoc(doc(db, `artifacts/${appId}/teams/${teamId}/tasks`, taskId), updateData);
  };

  const handlePhotoUpload = async (taskId, type, file) => {
    if (!teamId || !file) return;
    setUploadingTask(taskId);

    try {
      const compressedBase64 = await compressImage(file);
      const task = tasks.find((t) => t.id === taskId);
      const currentPhotos = task?.photos || { before: [], after: [] };
      const safePhotos = {
        before: Array.isArray(currentPhotos.before) ? currentPhotos.before : [],
        after: Array.isArray(currentPhotos.after) ? currentPhotos.after : [],
      };
      const updatedPhotos = {
        ...safePhotos,
        [type]: [...safePhotos[type], compressedBase64],
      };

      await updateDoc(doc(db, `artifacts/${appId}/teams/${teamId}/tasks`, taskId), {
        photos: updatedPhotos,
      });
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploadingTask(null);
    }
  };



  // ---- Render-Logik basierend auf Rolle und Ladezustand ----

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400">
        Lade Team-Daten...
      </div>
    );
  }

  // Wenn der Benutzer ein Mitarbeiter ist, zeige direkt die Staff-Ansicht
  if (role === "staff") {
    return (
      <>
        <StaffView
          tasks={tasks}
          staff={staff}
          authUser={authUser}
          onStatusChange={handleTaskStatusChange}
          onPhotoUpload={handlePhotoUpload}
          uploadingTask={uploadingTask}
          onImageSelect={setSelectedImage}
          teamId={teamId}
        />
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      </>
    );
  }
  
  // Wenn der Benutzer ein Owner ist (oder eine andere zukünftige Rolle hat)
  // zeige die volle Desktop-Anwendung.
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar view={view} setView={setView} setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="md:hidden bg-white p-4 flex items-center justify-between border-b border-slate-200 shadow-sm">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Brush className="text-emerald-500" /> CleanTeam
          </h1>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600">
            <Menu size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Hier werden die Views basierend auf dem State gerendert */}
            {view === "dashboard" && <DashboardView tasks={tasks} />}
            {view === "calendar" && <CalendarView tasks={tasks} staff={staff} />}
            {view === "properties" && <PropertiesView properties={properties} staff={staff} tasks={tasks} teamId={teamId} />}
            {view === "team" && <TeamView staff={staff} teamId={teamId} />}
            {view === "settings" && <SettingsView authUser={authUser} teamId={teamId} settings={appSettings || {}} existingTasks={tasks} existingProperties={properties} />}
            {view === "chat" && <TeamChat teamId={teamId} authUser={authUser} staff={staff} />}
          </div>
        </div>
      </main>

      {/* Modals werden später wieder hinzugefügt */}
    </div>
  );
}


/* ---------------- UI-Komponenten (temporär hier) ---------------- */

const Sidebar = ({ view, setView, sidebarOpen, setSidebarOpen }) => (
  <div
    className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    } md:relative md:translate-x-0 shadow-xl`}
  >
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
      <NavItem icon={<Home size={20} />} label="Einsatzplan" currentView={view} targetView="dashboard" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<Calendar size={20} />} label="Monatskalender" currentView={view} targetView="calendar" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<MapPin size={20} />} label="Objekte" currentView={view} targetView="properties" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<Users size={20} />} label="Team & Personal" currentView={view} targetView="team" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<Settings size={20} />} label="Einstellungen" currentView={view} targetView="settings" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<MessageSquare size={20} />} label="Chat" currentView={view} targetView="chat" setView={setView} setSidebarOpen={setSidebarOpen} />
    </nav>
    
    <div className="absolute bottom-0 w-full p-4 bg-slate-800/50">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-slate-800 text-slate-300"
        >
          <LogOut size={20} /> <span>Abmelden</span>
        </button>
    </div>
  </div>
);

const NavItem = ({ icon, label, currentView, targetView, setView, setSidebarOpen }) => (
  <button
    onClick={() => {
      setView(targetView);
      setSidebarOpen(false);
    }}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      currentView === targetView ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-300"
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);


const DashboardView = ({ tasks }) => {
    const pendingTasks = tasks.filter((t) => t.status === "pending").length;
    const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
  
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Einsatzplanung</h2>
            <p className="text-slate-500">Übersicht aller Check-outs und Reinigungen deines Teams.</p>
          </div>
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard icon={<Brush size={24} />} title="Offen" value={pendingTasks} color="blue" />
          <StatCard icon={<AlertTriangle size={24} />} title="In Arbeit" value={inProgressTasks} color="yellow" />
          <StatCard icon={<CheckCircle size={24} />} title="Erledigt" value={completedTasks} color="green" />
        </div>
  
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">Alle Aufgaben</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Keine Aufgaben gefunden. Führe einen Sync in den Einstellungen durch.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-slate-50">
                  <h4 className="font-semibold">{task.apartment}</h4>
                  <p className="text-sm text-slate-500">{task.date}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
};
  
const StatCard = ({ icon, title, value, color }) => {
    const colors = {
      blue: "bg-blue-100 text-blue-600",
      yellow: "bg-yellow-100 text-yellow-600",
      green: "bg-green-100 text-green-600",
    };
  
    return (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
        <div className={`p-3 rounded-full ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
      </div>
    );
};

const DEFAULT_CHECKLIST = [
  "Bettwaesche gewechselt",
  "Muell entsorgt & Neue Beutel",
  "Bad & Kueche desinfiziert",
  "Boeden gesaugt & gewischt",
  "Oberflaechen abgestaubt",
];

const StaffView = ({
  tasks,
  staff,
  authUser,
  onStatusChange,
  onPhotoUpload,
  uploadingTask,
  onImageSelect,
  teamId,
}) => {
  const me = staff.find((member) => member.id === authUser.uid);
  const myName = me?.name || authUser.email || "Staff";
  const myTasks = tasks
    .filter((task) => {
      if (Array.isArray(task.assignedTo)) {
        return task.assignedTo.includes(authUser.uid);
      }
      return task.assignedTo === authUser.uid;
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const pendingCount = myTasks.filter((t) => t.status === "pending").length;
  const completedCount = myTasks.filter((t) => t.status === "completed").length;

  const PhotoSection = ({ title, type, task }) => {
    const photos = task.photos?.[type] || [];
    const isUploading = uploadingTask === task.id;

    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-600 mb-2">{title}</h4>
        <div className="flex flex-wrap gap-2 mb-2">
          {photos.map((src, idx) => (
            <img
              key={idx}
              src={src}
              className="w-16 h-16 object-cover rounded border border-slate-200"
              alt={type}
              onClick={() => onImageSelect(src)}
            />
          ))}
          <label className={`w-16 h-16 flex items-center justify-center border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 ${isUploading ? "opacity-50 cursor-wait" : ""}`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => onPhotoUpload(task.id, type, e.target.files[0])}
            />
            {isUploading ? <RefreshCw className="animate-spin text-slate-400" size={20} /> : <Camera className="text-slate-400" size={20} />}
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <div className="p-6 bg-slate-900 text-white shadow-lg rounded-b-3xl mb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-slate-300 text-sm mb-1">Hello,</p>
            <h1 className="text-3xl font-bold">{myName}</h1>
          </div>
          <button onClick={signOut} className="bg-white/20 p-2 rounded-lg backdrop-blur-sm hover:bg-white/30">
            <LogOut size={20} />
          </button>
        </div>
        <div className="mt-6 flex gap-4">
          <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-xs text-slate-300">Open</p>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
            <p className="text-2xl font-bold">{completedCount}</p>
            <p className="text-xs text-slate-300">Done</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        <h2 className="font-bold text-slate-700 ml-1">Your tasks</h2>
        {myTasks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center shadow-sm">
            <CheckCircle size={32} className="mx-auto text-green-500 mb-3" />
            <h3 className="font-bold text-slate-800">All done!</h3>
          </div>
        ) : (
          myTasks.map((task) => (
            <div key={task.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${task.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {task.status === "pending" ? "To Do" : task.status === "in-progress" ? "In Progress" : "Done"}
                  </span>
                  <span className="text-sm text-slate-400">{formatDate(task.date)}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{task.apartment}</h3>
                {task.guestName && <p className="text-sm text-slate-500 mb-4">Guest: {task.guestName}</p>}

                {task.notes && (
                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-4">
                    <strong>Note:</strong> {task.notes}
                  </div>
                )}

                {task.status !== "completed" && (
                  <div className="space-y-4 mb-6 border-t border-slate-100 pt-4">
                    <PhotoSection title="Before photos (issues)" type="before" task={task} />
                    {task.status === "in-progress" && <PhotoSection title="After photos" type="after" task={task} />}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Checklist</p>
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
                  {task.status === "pending" && (
                    <button
                      onClick={() => onStatusChange(task.id, "in-progress")}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold shadow-blue-200 shadow-lg active:scale-95 transition-transform"
                    >
                      Start cleaning
                    </button>
                  )}
                  {task.status === "in-progress" && (
                    <>
                      <button
                        onClick={() => {
                          const issue = window.prompt("Report an issue");
                          if (issue) onStatusChange(task.id, "in-progress", issue);
                        }}
                        className="px-4 bg-red-100 text-red-600 rounded-xl font-medium"
                      >
                        <AlertTriangle size={20} />
                      </button>
                      <button
                        onClick={() => onStatusChange(task.id, "completed")}
                        className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold shadow-emerald-200 shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={20} /> Finish
                      </button>
                    </>
                  )}
                  {task.status === "completed" && (
                    <div className="w-full text-center py-2 text-green-600 font-medium bg-green-50 rounded-lg">
                      Completed
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 mt-8">
        <TeamChat teamId={teamId} authUser={authUser} staff={staff} />
      </div>
    </div>
  );
};

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

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
};

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let { width, height } = img;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
    };
  });
};
