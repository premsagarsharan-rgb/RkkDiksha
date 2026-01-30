"use client";

import { useState, useEffect } from "react";
import CustomerCard from "@/components/CustomerCard";

export default function EventDetailModal({ eventId, onClose }) {
  const [event, setEvent] = useState(null);
  const [invites, setInvites] = useState([]);
  const [sitting, setSitting] = useState([]);
  const [newLimit, setNewLimit] = useState("");

  async function load() {
    const [eRes, iRes, sRes] = await Promise.all([
      fetch(`/api/events/${eventId}`),
      fetch(`/api/events/${eventId}/invites`),
      fetch("/api/customers/sitting")
    ]);
    const e = await eRes.json();
    const i = await iRes.json();
    const s = await sRes.json();

    setEvent(e.event || null);
    setInvites(i.invites || []);
    setSitting(s.items || []);
    setNewLimit(e.event?.inviteLimit || 20);
  }

  useEffect(() => { if (eventId) load(); }, [eventId]);

  async function updateLimit() {
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ inviteLimit: Number(newLimit) }),
      headers: { "Content-Type": "application/json" }
    });
    load();
  }

  async function addToEvent(customerId) {
    await fetch(`/api/events/${eventId}/invites`, {
      method: "POST",
      body: JSON.stringify({ customerId }),
      headers: { "Content-Type": "application/json" }
    });
    load();
  }

  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">{event.title}</h2>
            <p>{event.date} | {event.startTime} - {event.endTime || "?"}</p>
            <p>Type: {event.type} | Limit: {event.inviteLimit}</p>
          </div>
          <button onClick={onClose} className="text-3xl">×</button>
        </div>

        {session.role === "ADMIN" && (
          <div className="mt-3 flex gap-2">
            <input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} className="border px-2" />
            <button onClick={updateLimit} className="bg-black text-white px-3 py-1 rounded">Update Limit</button>
          </div>
        )}

        <div className="mt-6">
          <h3 className="font-semibold">Invited Customers ({invites.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {invites.map(i => (
              <CustomerCard key={i._id} customer={i.customer} onOut={() => {
                fetch(`/api/events/${eventId}/invites/${i._id}/out`, { method: "POST" });
                load();
              }} />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-semibold">Add from Sitting DB</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 max-h-96 overflow-y-auto">
            {sitting
              .filter(c => !invites.some(iv => iv.customer._id === String(c._id)))
              .map(c => (
                <div key={c._id} className="border p-3 rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => addToEvent(String(c._id))}>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm">{c.phone} | {c.city} | Age: {c.age}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
