import React, { useEffect, useState } from "react";
import { db, appId } from "./firebase";
import { signOut } from "./auth/authService";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import TeamView from "./components/views/Team";
import SettingsView from "./components/views/Settings";
import CalendarView from "./components/views/CalendarView";
import PropertiesView from "./components/views/PropertiesView";
import BillingView from "./components/views/BillingView";
import TaskModal from "./components/TaskModal";
import AdminChat from "./components/chat/AdminChat";
import StaffChat from "./components/chat/StaffChat";
import {
  AlertTriangle,
  Brush,
  Camera,
  Calendar,
  CheckCircle,
  ClipboardList,
  Home,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Receipt,
  RefreshCw,
  Users,
  X,
} from "lucide-react";

const safeArray = (v) => (Array.isArray(v) ? v : []);
const todayISO = () => new Date().toISOString().split("T")[0];

export default function CleanTeamApp({ authUser }) {
  const [loading, setLoading] = useState(true);
  const { teamId, role } = authUser;

  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [properties, setProperties] = useState([]);
  const [appSettings, setAppSettings] = useState(null);

  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingTask, setUploadingTask] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [isSavingTask, setIsSavingTask] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

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

    const unsubTasks = onSnapshot(
      collection(db, ...base, "tasks"),
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Fehler beim Laden der Aufgaben:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubSettings();
      unsubStaff();
      unsubProperties();
      unsubTasks();
    };
  }, [teamId]);

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

  const handleTaskUpdate = async (taskId, updates) => {
    if (!teamId || !taskId) return;
    setIsSavingTask(true);
    try {
      await updateDoc(doc(db, `artifacts/${appId}/teams/${teamId}/tasks`, taskId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      setActiveTask(null);
    } catch (err) {
      console.error("Task Update Fehler:", err);
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleChecklistToggle = async (task, index) => {
    if (!teamId || !task?.id) return;
    const done = safeArray(task.checklistDone);
    const next = done.includes(index) ? done.filter((i) => i !== index) : [...done, index];
    await updateDoc(doc(db, `artifacts/${appId}/teams/${teamId}/tasks`, task.id), {
      checklistDone: next,
    });
  };

  const getPosition = () => new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  const logWork = async (taskId, payload) => {
    if (!teamId || !taskId) return;
    const logRef = doc(db, `artifacts/${appId}/teams/${teamId}/tasks/${taskId}/workLogs`, authUser.uid);
    await setDoc(logRef, {
      uid: authUser.uid,
      ...payload,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  };

  const startTaskForStaff = async (task) => {
    const location = await getPosition();
    await logWork(task.id, {
      startedAt: new Date().toISOString(),
      startLocation: location,
    });
    await handleTaskStatusChange(task.id, "in-progress");
  };

  const completeTaskForStaff = async (task) => {
    const location = await getPosition();
    await logWork(task.id, {
      completedAt: new Date().toISOString(),
      endLocation: location,
    });
    await handleTaskStatusChange(task.id, "completed");
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400">
        Lade Team-Daten...
      </div>
    );
  }

  if (role === "staff") {
    return (
      <>
        <StaffView
          tasks={tasks}
          staff={staff}
          authUser={authUser}
          onStatusChange={handleTaskStatusChange}
          onStartTask={startTaskForStaff}
          onCompleteTask={completeTaskForStaff}
          onPhotoUpload={handlePhotoUpload}
          uploadingTask={uploadingTask}
          onImageSelect={setSelectedImage}
          onChecklistToggle={handleChecklistToggle}
          teamId={teamId}
        />
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--ct-bg)] text-slate-900 overflow-hidden">
      <Sidebar view={view} setView={setView} setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="md:hidden bg-white/80 backdrop-blur p-4 flex items-center justify-between border-b border-slate-200">
          <button
            onClick={() => setView("dashboard")}
            className="font-bold text-lg flex items-center gap-2"
          >
            <img src={`${import.meta.env.DEV ? "/" : import.meta.env.BASE_URL}cleanteam-icon.svg`} alt="CleanTeam" className="h-6 w-6" />
            CleanTeam
          </button>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600">
            <Menu size={24} />
          </button>
        </div>

        <div className={`flex-1 overflow-auto ${view === "chat" ? "p-4 md:p-6" : "p-4 md:p-8"}`}>
          <div className={`${view === "chat" ? "h-[calc(100vh-120px)] min-h-[520px]" : "max-w-7xl mx-auto space-y-6"} ${view === "chat" ? "mx-auto w-full" : ""}`}>
            {view === "dashboard" && (
              <DashboardView
                tasks={tasks}
                staff={staff}
                onOpenTask={setActiveTask}
              />
            )}
            {view === "calendar" && (
              <CalendarView tasks={tasks} staff={staff} onTaskSelect={setActiveTask} />
            )}
            {view === "properties" && (
              <PropertiesView properties={properties} staff={staff} tasks={tasks} teamId={teamId} />
            )}
            {view === "billing" && (
              <BillingView tasks={tasks} staff={staff} properties={properties} teamId={teamId} />
            )}
            {view === "team" && <TeamView staff={staff} teamId={teamId} />}
            {view === "settings" && (
              <SettingsView
                authUser={authUser}
                teamId={teamId}
                settings={appSettings || {}}
                existingTasks={tasks}
                existingProperties={properties}
              />
            )}
            {view === "chat" && (
              <AdminChat teamId={teamId} authUser={authUser} staff={staff} className="h-full min-h-0" />
            )}
          </div>
        </div>
      </main>

      {activeTask && (
        <TaskModal
          task={activeTask}
          staff={staff}
          teamId={teamId}
          properties={properties}
          onImageSelect={setSelectedImage}
          onClose={() => setActiveTask(null)}
          onSave={handleTaskUpdate}
          isSaving={isSavingTask}
        />
      )}
      <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
}

const Sidebar = ({ view, setView, sidebarOpen, setSidebarOpen }) => (
  <div
    className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    } md:relative md:translate-x-0 shadow-xl`}
  >
    <div className="p-6 flex items-center justify-between">
      <button
        onClick={() => {
          setView("dashboard");
          setSidebarOpen(false);
        }}
        className="text-2xl font-bold flex items-center gap-2"
      >
        <img src={`${import.meta.env.DEV ? "/" : import.meta.env.BASE_URL}cleanteam-icon.svg`} alt="CleanTeam" className="h-7 w-7" />
        CleanTeam
      </button>
      <button onClick={() => setSidebarOpen(false)} className="md:hidden">
        <X size={24} />
      </button>
    </div>

    <nav className="mt-6 px-4 space-y-2">
      <NavItem icon={<Home size={20} />} label="Uebersicht" currentView={view} targetView="dashboard" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<Calendar size={20} />} label="Monatskalender" currentView={view} targetView="calendar" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<MapPin size={20} />} label="Objekte" currentView={view} targetView="properties" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<Receipt size={20} />} label="Abrechnungen" currentView={view} targetView="billing" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<Users size={20} />} label="Team" currentView={view} targetView="team" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<ClipboardList size={20} />} label="Einstellungen" currentView={view} targetView="settings" setView={setView} setSidebarOpen={setSidebarOpen} />
      <NavItem icon={<MessageSquare size={20} />} label="Chat" currentView={view} targetView="chat" setView={setView} setSidebarOpen={setSidebarOpen} />
    </nav>

    <div className="absolute bottom-0 w-full p-4 bg-slate-800/60">
      <button
        onClick={signOut}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-slate-800 text-slate-300"
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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
      currentView === targetView ? "bg-teal-600 text-white" : "hover:bg-slate-800 text-slate-300"
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);

const DashboardView = ({ tasks, staff, onOpenTask }) => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");

  const safeTasks = safeArray(tasks);
  const safeStaff = safeArray(staff);

  const filteredTasks = safeTasks
    .filter((task) => (statusFilter === "all" ? true : task.status === statusFilter))
    .filter((task) => {
      if (staffFilter === "all") return true;
      const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [];
      return assignedIds.includes(staffFilter);
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const pendingCount = safeTasks.filter((t) => t.status === "pending").length;
  const inProgressCount = safeTasks.filter((t) => t.status === "in-progress").length;
  const completedCount = safeTasks.filter((t) => t.status === "completed").length;
  const todayTasks = safeTasks.filter((t) => t.date === todayISO());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Uebersicht</h2>
          <p className="text-slate-500">Tagesstatus und Aufgaben im Blick.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<Brush size={22} />} title="Offen" value={pendingCount} color="bg-slate-900" />
        <StatCard icon={<AlertTriangle size={22} />} title="In Arbeit" value={inProgressCount} color="bg-amber-500" />
        <StatCard icon={<CheckCircle size={22} />} title="Erledigt" value={completedCount} color="bg-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Aufgabenliste</h3>
              <p className="text-xs text-slate-500">Filtere nach Status oder Teammitglied.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all", label: "Alle" },
                { id: "pending", label: "Offen" },
                { id: "in-progress", label: "In Arbeit" },
                { id: "completed", label: "Erledigt" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    statusFilter === filter.id
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-600 bg-white"
              >
                <option value="all">Alle Mitarbeiter</option>
                {safeStaff.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Keine Aufgaben gefunden.</div>
            ) : (
              filteredTasks.map((task) => {
                const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [];
                return (
                  <div key={task.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">{task.date || "Kein Datum"}</p>
                      <h4 className="text-lg font-semibold text-slate-900">{task.apartment || "Ohne Titel"}</h4>
                      <p className="text-xs text-slate-500">Status: {statusLabel(task.status)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {assignedIds.map((id) => {
                          const member = safeStaff.find((s) => s.id === id);
                          if (!member) return null;
                          return (
                            <div
                              key={id}
                              title={member.name}
                              className={`w-8 h-8 rounded-full border-2 border-white ${member.color || "bg-slate-400"} flex items-center justify-center text-white text-xs font-bold`}
                            >
                              {member.name?.charAt(0) || "?"}
                            </div>
                          );
                        })}
                        {assignedIds.length === 0 && <span className="text-xs text-slate-400 italic">Unzugewiesen</span>}
                      </div>
                      <button
                        onClick={() => onOpenTask(task)}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800"
                      >
                        Bearbeiten
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Heute</h3>
          {todayTasks.length === 0 && <p className="text-sm text-slate-500">Keine Aufgaben fuer heute.</p>}
          {todayTasks.map((task) => (
            <div key={task.id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">{statusLabel(task.status)}</p>
              <p className="font-semibold text-slate-800">{task.apartment}</p>
              <button onClick={() => onOpenTask(task)} className="text-xs text-teal-600 mt-1">Details</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, color }) => (
  <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-2xl text-white ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const DEFAULT_CHECKLIST = [
  "Bettwaesche gewechselt",
  "Muell entsorgt und neue Beutel",
  "Bad und Kueche desinfiziert",
  "Boeden gesaugt und gewischt",
  "Oberflaechen abgestaubt",
];

const StaffView = ({
  tasks,
  staff,
  authUser,
  onStatusChange,
  onStartTask,
  onCompleteTask,
  onPhotoUpload,
  uploadingTask,
  onImageSelect,
  onChecklistToggle,
  teamId,
}) => {
  const safeTasks = safeArray(tasks);
  const safeStaff = safeArray(staff);
  const me = safeStaff.find((member) => member.id === authUser.uid);
  const myName = me?.name || authUser.email || "Team";
  const myTasks = safeTasks
    .filter((task) => {
      const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [];
      return assignedIds.includes(authUser.uid);
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const [statusFilter, setStatusFilter] = useState("pending");
  const [chatOpen, setChatOpen] = useState(false);

  const pendingCount = myTasks.filter((t) => t.status === "pending").length;
  const inProgressCount = myTasks.filter((t) => t.status === "in-progress").length;
  const completedCount = myTasks.filter((t) => t.status === "completed").length;
  const totalCount = myTasks.length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const filteredTasks = myTasks.filter((task) => {
    if (statusFilter === "all") return true;
    return task.status === statusFilter;
  });

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const PhotoSection = ({ title, type, task }) => {
    const photos = task.photos?.[type] || [];
    const isUploading = uploadingTask === task.id;

    return (
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {photos.map((src, idx) => (
            <img
              key={idx}
              src={src}
              className="w-20 h-20 object-cover rounded-xl border border-slate-200"
              alt={type}
              onClick={() => onImageSelect(src)}
            />
          ))}
          <label className={`w-20 h-20 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 ${isUploading ? "opacity-50 cursor-wait" : ""}`}>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-100 to-slate-50 pb-16">
      <div className="px-4 pt-6">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-[28px] p-6 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <button
                onClick={() => {
                  setStatusFilter("pending");
                  setChatOpen(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center gap-2 mb-2"
              >
                <img
                  src={`${import.meta.env.DEV ? "/" : import.meta.env.BASE_URL}cleanteam-icon.svg`}
                  alt="CleanTeam"
                  className="h-6 w-6"
                />
                <span className="text-sm text-slate-300">CleanTeam</span>
              </button>
              <p className="text-slate-300 text-sm mb-1">Guten Tag,</p>
              <h1 className="text-3xl font-bold">{myName}</h1>
              <p className="text-slate-400 text-sm">{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}</p>
            </div>
            <button onClick={signOut} className="bg-white/10 p-2 rounded-xl backdrop-blur-sm hover:bg-white/20">
              <LogOut size={20} />
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatPill label="Offen" value={pendingCount} />
            <StatPill label="In Arbeit" value={inProgressCount} />
            <StatPill label="Erledigt" value={completedCount} />
            <StatPill label="Gesamt" value={totalCount} />
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Fortschritt</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full mt-2">
              <div className="h-2 bg-teal-400 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "pending", label: `Offen (${pendingCount})` },
            { id: "in-progress", label: `In Arbeit (${inProgressCount})` },
            { id: "completed", label: `Erledigt (${completedCount})` },
            { id: "all", label: `Alle (${totalCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                statusFilter === tab.id
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl text-center shadow-sm">
            <CheckCircle size={32} className="mx-auto text-emerald-500 mb-3" />
            <h3 className="font-bold text-slate-800">Keine Aufgaben in dieser Ansicht</h3>
            <p className="text-sm text-slate-500">Wechsle den Filter oder warte auf neue Aufgaben.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-400">{task.date || "Kein Datum"}</p>
                      <h3 className="text-lg font-bold text-slate-800">{task.apartment}</h3>
                      {task.guestName && <p className="text-sm text-slate-500">Gast: {task.guestName}</p>}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${statusBadge(task.status)}`}>
                      {statusLabel(task.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Start: {formatDateTime(task.startedAt)}</span>
                    <span>Stop: {formatDateTime(task.completedAt)}</span>
                  </div>

                  {task.notes && (
                    <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm">
                      <strong>Notiz:</strong> {task.notes}
                    </div>
                  )}

                  {task.issueReport && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">
                      <strong>Problem gemeldet:</strong> {task.issueReport}
                    </div>
                  )}

                  {task.status !== "completed" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PhotoSection title="Vorher-Fotos" type="before" task={task} />
                      {task.status === "in-progress" && (
                        <PhotoSection title="Nachher-Fotos" type="after" task={task} />
                      )}
                    </div>
                  )}

                  {task.status !== "completed" && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Checkliste</p>
                      {(task.checklist || DEFAULT_CHECKLIST).map((item, idx) => {
                        const done = safeArray(task.checklistDone).includes(idx);
                        return (
                          <label key={idx} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => onChecklistToggle(task, idx)}
                              className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                            />
                            <span className={`text-slate-700 text-sm ${done ? "line-through text-slate-400" : ""}`}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {task.status === "pending" && (
                      <button
                        onClick={() => onStartTask(task)}
                        className="flex-1 min-w-[160px] bg-blue-600 text-white py-3 rounded-xl font-semibold shadow-blue-200 shadow-lg active:scale-95 transition-transform"
                      >
                        Starten
                      </button>
                    )}
                    {task.status === "in-progress" && (
                      <>
                        <button
                          onClick={() => {
                            const issue = window.prompt("Problem melden");
                            if (issue) onStatusChange(task.id, "in-progress", issue);
                          }}
                          className="px-4 py-3 bg-red-100 text-red-600 rounded-xl font-medium"
                        >
                          <AlertTriangle size={20} />
                        </button>
                        <button
                          onClick={() => onCompleteTask(task)}
                          className="flex-1 min-w-[160px] bg-emerald-600 text-white py-3 rounded-xl font-semibold shadow-emerald-200 shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={20} /> Erledigt
                        </button>
                      </>
                    )}
                    {task.status === "completed" && (
                      <div className="w-full text-center py-2 text-green-700 font-medium bg-green-50 rounded-xl">
                        Abgeschlossen
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-800">Chat</h3>
            <button
              onClick={() => setChatOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              Vollbild oeffnen
            </button>
          </div>
          <StaffChat teamId={teamId} authUser={authUser} staff={staff} />
        </div>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/80 backdrop-blur-sm p-4 md:p-6">
          <div className="h-full max-w-5xl mx-auto">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-3 text-white">
                <h2 className="text-lg font-semibold">Chat</h2>
                <button
                  onClick={() => setChatOpen(false)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20"
                >
                  Schliessen
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <StaffChat teamId={teamId} authUser={authUser} staff={staff} fullscreen />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatPill = ({ label, value }) => (
  <div className="bg-white/15 px-3 py-2 rounded-xl text-center">
    <p className="text-xl font-bold">{value}</p>
    <p className="text-xs text-slate-300">{label}</p>
  </div>
);

const ImageModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-4xl w-full flex justify-center">
        <img src={src} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" alt="Detail" onClick={(e) => e.stopPropagation()} />
        <button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors bg-white/10 p-2 rounded-full">
          <X size={24} />
        </button>
      </div>
    </div>
  );
};

const statusLabel = (status) => {
  switch (status) {
    case "pending":
      return "Offen";
    case "in-progress":
      return "In Arbeit";
    case "completed":
      return "Erledigt";
    default:
      return status || "Offen";
  }
};

const statusBadge = (status) => {
  switch (status) {
    case "pending":
      return "bg-blue-100 text-blue-700";
    case "in-progress":
      return "bg-amber-100 text-amber-700";
    case "completed":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
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
