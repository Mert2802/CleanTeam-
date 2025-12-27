import React, { useEffect, useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { Download, Receipt } from "lucide-react";
import { db, appId } from "../../firebase";

const safeArray = (v) => (Array.isArray(v) ? v : []);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDuration = (start, end) => {
  if (!start || !end) return "-";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "-";
  const diffMs = endDate - startDate;
  if (diffMs <= 0) return "-";
  const minutes = Math.round(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const formatCurrency = (value) => {
  if (value == null) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
};

const buildCsv = (rows) => {
  const escape = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Datum",
    "Unterkunft",
    "Mitarbeiter",
    "Dauer",
    "Betrag",
  ];
  const lines = [header.map(escape).join(";")];
  rows.forEach((row) => {
    lines.push(
      [row.date, row.apartment, row.staff, row.duration, row.amount]
        .map(escape)
        .join(";")
    );
  });
  return lines.join("\n");
};

export default function BillingView({ tasks, staff, properties, teamId }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [billingMode, setBillingMode] = useState("fixed");
  const [fixedRate, setFixedRate] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [savingRates, setSavingRates] = useState(false);

  const safeTasks = safeArray(tasks);
  const safeStaff = safeArray(staff);
  const safeProperties = safeArray(properties);

  const staffById = useMemo(() => new Map(safeStaff.map((s) => [s.id, s])), [safeStaff]);

  const propertyNames = useMemo(() => {
    const names = new Set();
    safeProperties.forEach((p) => p?.name && names.add(p.name));
    return Array.from(names).sort();
  }, [safeProperties]);

  useEffect(() => {
    if (staffFilter === "all") return;
    const member = staffById.get(staffFilter);
    if (!member) return;
    setBillingMode(member.billingMode || "fixed");
    setFixedRate(Number(member.fixedRate || 0));
    setHourlyRate(Number(member.hourlyRate || 0));
  }, [staffFilter, staffById]);

  const completedTasks = safeTasks.filter((t) => t.status === "completed");

  const filteredTasks = completedTasks.filter((task) => {
    if (fromDate && task.date && task.date < fromDate) return false;
    if (toDate && task.date && task.date > toDate) return false;
    if (propertyFilter !== "all" && task.apartment !== propertyFilter) return false;
    if (staffFilter !== "all") {
      const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [];
      if (!assignedIds.includes(staffFilter)) return false;
    }
    return true;
  });

  const calcAmountForTask = (task, staffId) => {
    const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [];
    if (assignedIds.length === 0) return null;
    if (staffId && !assignedIds.includes(staffId)) return null;
    const split = assignedIds.length;
    const targets = staffId ? [staffId] : assignedIds;

    return targets.reduce((sum, uid) => {
      const member = staffById.get(uid);
      if (!member) return sum;
      const mode = member.billingMode || "fixed";
      const fixed = Number(member.fixedRate || 0);
      const hourly = Number(member.hourlyRate || 0);
      let amount = 0;
      if (mode === "hourly") {
        if (task.startedAt && task.completedAt) {
          const hours = (new Date(task.completedAt) - new Date(task.startedAt)) / 3600000;
          amount = Math.max(0, hours) * hourly;
        }
      } else {
        amount = fixed;
      }
      return sum + amount / split;
    }, 0);
  };

  const totalAmount = filteredTasks.reduce((sum, task) => {
    const amount = calcAmountForTask(task, staffFilter === "all" ? null : staffFilter);
    return sum + (amount || 0);
  }, 0);

  const exportCsv = () => {
    const rows = filteredTasks.map((task) => {
      const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [];
      const staffNames = assignedIds.map((id) => staffById.get(id)?.name || id).join(", ") || "-";
      const duration = formatDuration(task.startedAt, task.completedAt);
      const amount = calcAmountForTask(task, staffFilter === "all" ? null : staffFilter);
      return {
        date: task.date || "-",
        apartment: task.apartment || "-",
        staff: staffNames,
        duration,
        amount: amount != null ? formatCurrency(amount) : "-",
      };
    });

    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `abrechnung_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveRates = async () => {
    if (!teamId || staffFilter === "all") return;
    setSavingRates(true);
    try {
      const memberRef = doc(db, `artifacts/${appId}/teams/${teamId}/members`, staffFilter);
      await updateDoc(memberRef, {
        billingMode,
        fixedRate: Number(fixedRate || 0),
        hourlyRate: Number(hourlyRate || 0),
      });
    } finally {
      setSavingRates(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Abrechnungen</h2>
          <p className="text-slate-500">Vergangene Reinigungen filtern und exportieren.</p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
        >
          <Download size={18} /> CSV Export
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div>
          <label className="text-xs text-slate-500">Von</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Bis</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Unterkunft</label>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          >
            <option value="all">Alle</option>
            {propertyNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Mitarbeiter</label>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          >
            <option value="all">Alle</option>
            {safeStaff.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-3 w-full">
            <p className="text-xs text-teal-600">Summe</p>
            <p className="text-lg font-semibold text-teal-700">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      </div>

      {staffFilter !== "all" && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Receipt size={20} className="text-slate-400" />
            <h3 className="text-lg font-semibold text-slate-900">Abrechnungsprofil</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500">Modell</label>
              <select
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="fixed">Fixpreis</option>
                <option value="hourly">Stundenbasiert</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Fixpreis (EUR)</label>
              <input
                type="number"
                value={fixedRate}
                onChange={(e) => setFixedRate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Stundenlohn (EUR)</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveRates}
              disabled={savingRates}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              {savingRates ? "Speichern..." : "Profil speichern"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Datum</th>
                <th className="text-left px-4 py-3">Unterkunft</th>
                <th className="text-left px-4 py-3">Mitarbeiter</th>
                <th className="text-left px-4 py-3">Dauer</th>
                <th className="text-left px-4 py-3">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Keine abgeschlossenen Reinigungen im Filter.</td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const assignedIds = Array.isArray(task.assignedTo) ? task.assignedTo : task.assignedTo ? [task.assignedTo] : [];
                  const staffNames = assignedIds.map((id) => staffById.get(id)?.name || id).join(", ") || "-";
                  const amount = calcAmountForTask(task, staffFilter === "all" ? null : staffFilter);
                  return (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{formatDate(task.date)}</td>
                      <td className="px-4 py-3">{task.apartment || "-"}</td>
                      <td className="px-4 py-3">{staffNames}</td>
                      <td className="px-4 py-3">{formatDuration(task.startedAt, task.completedAt)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(amount)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
