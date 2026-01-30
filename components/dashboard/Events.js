// components/dashboard/Events.js
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

// Date helpers (No date-fns, no moment)
const today = new Date();
const getISODate = (date) => date.toISOString().split("T")[0];

export default function Events({ role }) {
  // --- STATE ---
  const [view, setView] = useState("week"); // "week" | "month"
  const [currentDate, setCurrentDate] = useState(new Date()); // Anchor date
  const [selectedDate, setSelectedDate] = useState(null); // Date object clicked
  const [events, setEvents] = useState({}); // Map: "YYYY-MM-DD" -> [Event]

  // Loading states
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Modals
  const [showEventCreateModal, setShowEventCreateModal] = useState(false);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null); // For Detail Modal

  // Data for Detail Modal (Invites / Sitting Customers)
  const [invites, setInvites] = useState([]);
  const [sittingCustomers, setSittingCustomers] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- HELPERS ---

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  // Month Grid Logic (Padding + Days)
  const monthGrid = useMemo(() => {
    const { firstDay, daysInMonth } = getDaysInMonth(currentDate);
    const days = [];

    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }

    return days;
  }, [currentDate]);

  // Week Grid Logic (Current week around currentDate)
  const weekGrid = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 is Sunday
    const diff = curr.getDate() - day; // adjust when day is sunday

    const sunday = new Date(curr.setDate(diff));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const daysToRender = view === "month" ? monthGrid : weekGrid;

  // --- DATA FETCHING ---

  const fetchEvents = useCallback(async (startDate, endDate) => {
    setIsLoadingEvents(true);
    try {
      const from = getISODate(startDate);
      const to = getISODate(endDate);
      const res = await fetch(`/api/events?from=${from}&to=${to}`);
      const data = await res.json();

      // Convert array to map for O(1) lookup
      const map = {};
      (data.items || []).forEach((ev) => {
        if (!map[ev.date]) map[ev.date] = [];
        map[ev.date].push(ev);
      });
      setEvents(map);
    } catch (err) {
      console.error(err);
    }
    setIsLoadingEvents(false);
  }, []);

  // Fetch events whenever view/date changes
  useEffect(() => {
    if (view === "week") {
      const start = weekGrid[0];
      const end = weekGrid[6];
      fetchEvents(start, end);
    } else {
      // Month view: fetch full month plus small buffer
      const start = monthGrid.find((d) => d !== null);
      const end = monthGrid.filter((d) => d !== null).pop();
      if (start && end) fetchEvents(start, end);
    }
  }, [view, currentDate, monthGrid, weekGrid, fetchEvents]);

  // --- EVENT HANDLERS ---

  const handlePrev = () => {
    if (view === "month") {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (view === "month") {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setShowEventCreateModal(true);
  };

  const handleEventClick = (e, ev) => {
    e.stopPropagation(); // Prevent day click
    setSelectedEvent(ev);
    openEventDetailModal(ev);
  };

  // --- EVENT CREATE ---

  const createEvent = async (formData) => {
    const dateStr = getISODate(selectedDate);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, date: dateStr }),
    });
    if (res.ok) {
      setShowEventCreateModal(false);
      // Refresh range
      if (view === "week") {
        fetchEvents(weekGrid[0], weekGrid[6]);
      } else {
        const start = monthGrid.find((d) => d !== null);
        const end = monthGrid.filter((d) => d !== null).pop();
        if (start && end) fetchEvents(start, end);
      }
      // Open detail of newly created event
      const data = await res.json();
      openEventDetailModal({ ...formData, _id: data.id, date: dateStr });
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Create failed");
    }
  };

  // --- EVENT DETAIL / INVITE LOGIC ---

  const openEventDetailModal = async (ev) => {
    setSelectedEvent(ev);
    setShowEventDetailModal(true);
    setLoadingDetail(true);
    try {
      const [invRes, sitRes] = await Promise.all([
        fetch(`/api/events/${ev._id}/invites`),
        fetch("/api/customers/sitting"),
      ]);
      const invData = await invRes.json();
      const sitData = await sitRes.json();

      setInvites(invData.invites || []);
      // Only ACTIVE customers can be invited
      setSittingCustomers((sitData.items || []).filter((c) => c.status === "ACTIVE"));
    } catch (err) {
      console.error(err);
    }
    setLoadingDetail(false);
  };

  const inviteCustomer = async (customerId) => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/events/${selectedEvent._id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Invite failed");
        return;
      }
      // Refresh detail
      openEventDetailModal(selectedEvent);
    } catch (err) {
      alert("Network error");
    }
  };

  const removeFromEvent = async (inviteId) => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/events/${selectedEvent._id}/invites/${inviteId}/out`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed");
        return;
      }
      openEventDetailModal(selectedEvent);
    } catch (err) {
      alert("Network error");
    }
  };

  const updateLimit = async () => {
    if (role !== "ADMIN" || !selectedEvent) return;
    const newLimit = prompt("New limit?", selectedEvent.inviteLimit);
    if (!newLimit) return;
    try {
      const res = await fetch(`/api/events/${selectedEvent._id}/limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteLimit: parseInt(newLimit) }),
      });
      if (res.ok) {
        openEventDetailModal({ ...selectedEvent, inviteLimit: parseInt(newLimit) });
        // Refresh calendar range if needed (optional, but good for consistency)
        alert("Limit updated");
      } else {
        alert("Failed");
      }
    } catch (err) {
      alert("Network error");
    }
  };

  // --- RENDER HELPERS ---
  const isToday = (date) => {
    const d = new Date();
    return (
      date.getDate() === d.getDate() &&
      date.getMonth() === d.getMonth() &&
      date.getFullYear() === d.getFullYear()
    );
  };

  const getTheme = (gender) => {
    if (gender === "MALE") return "bg-black text-white";
    if (gender === "FEMALE") return "bg-pink-600 text-white";
    return "bg-green-300 text-black";
  };

  // --- COMPONENTS ---

  const WeekHeader = () => (
    <div className="grid grid-cols-7 gap-px bg-gray-200 text-center text-sm font-semibold py-2">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d}>{d}</div>
      ))}
    </div>
  );

  // --- MAIN RETURN ---

  return (
    <div className="flex flex-col h-full">
      {/* Header / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded hover:bg-gray-100 text-gray-600"
          >
            &lt; Prev
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded hover:bg-gray-100 text-gray-600"
          >
            Next &gt;
          </button>
          <h2 className="text-lg font-bold min-w-[200px] text-center">
            {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Today
          </button>
        </div>

        <div className="flex bg-gray-100 rounded p-1">
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1 text-sm rounded transition ${
              view === "week" ? "bg-white shadow text-black" : "text-gray-500"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView("month")}
            className={`px-3 py-1 text-sm rounded transition ${
              view === "month" ? "bg-white shadow text-black" : "text-gray-500"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-white border rounded shadow-sm overflow-hidden flex flex-col">
        <WeekHeader />

        <div
          className={`grid gap-px bg-gray-200 ${
            view === "month" ? "grid-rows-5 grid-rows-6" : "grid-rows-1"
          } flex-1`}
        >
          {daysToRender.map((date, idx) => {
            if (!date) {
              return (
                <div key={`empty-${idx}`} className="bg-gray-50 border border-gray-100"></div>
              );
            }

            const dateStr = getISODate(date);
            const dayEvents = events[dateStr] || [];

            return (
              <div
                key={dateStr}
                onClick={() => handleDayClick(date)}
                className={`bg-white relative p-1 h-full border-t border-r hover:bg-gray-50 cursor-pointer overflow-hidden ${
                  view === "month" ? "min-h-[100px]" : ""
                }`}
              >
                <span
                  className={`inline-flex w-6 h-6 items-center justify-center text-sm rounded-full ${
                    isToday(date) ? "bg-black text-white" : "text-gray-700"
                  }`}
                >
                  {date.getDate()}
                </span>

                <div className="mt-1 space-y-1">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev._id}
                      onClick={(e) => handleEventClick(e, ev)}
                      className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-800 truncate cursor-pointer hover:bg-blue-200 border border-blue-200"
                    >
                      {ev.startTime} {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: Create Event */}
      {showEventCreateModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">
              Create Event on {selectedDate.toDateString()}
            </h3>
            <EventCreateForm
              onSubmit={createEvent}
              onCancel={() => setShowEventCreateModal(false)}
              type={view} // 'week' or 'month' could influence defaults
            />
          </div>
        </div>
      )}

      {/* MODAL: Event Detail & Invites */}
      {showEventDetailModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 my-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{selectedEvent.title}</h3>
                <p className="text-sm text-gray-600">
                  {selectedEvent.date} | {selectedEvent.startTime} - {selectedEvent.endTime}
                </p>
                <p className="text-xs text-gray-500">
                  Type: {selectedEvent.type} | Limit: {selectedEvent.inviteLimit}
                </p>
              </div>
              <div className="flex gap-2">
                {role === "ADMIN" && (
                  <button
                    onClick={updateLimit}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                  >
                    Edit Limit
                  </button>
                )}
                <button
                  onClick={() => setShowEventDetailModal(false)}
                  className="text-2xl text-gray-500 hover:text-black"
                >
                  &times;
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="py-4 text-center text-gray-500">Loading details...</div>
            ) : (
              <>
                {/* Invited Customers */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-2 text-sm border-b pb-1">
                    Invited ({invites.length}/{selectedEvent.inviteLimit})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {invites.length === 0 && (
                      <p className="text-xs text-gray-400 col-span-2">No customers yet</p>
                    )}
                    {invites.map((inv) => (
                      <div
                        key={inv._id}
                        className={`flex justify-between items-center p-2 rounded ${getTheme(
                          inv.customer.gender
                        )}`}
                      >
                        <div>
                          <div className="font-medium text-sm">{inv.customer.name}</div>
                          <div className="text-xs opacity-80">{inv.customer.phone}</div>
                        </div>
                        <button
                          onClick={() => removeFromEvent(inv._id)}
                          className="px-2 py-1 bg-white/20 rounded text-xs"
                          title="Out"
                        >
                          ⏸️ Out
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invite Section */}
                <div>
                  <h4 className="font-semibold mb-2 text-sm border-b pb-1">
                    Invite from Sitting DB
                  </h4>
                  {sittingCustomers.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No ACTIVE customers available in Sitting DB.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                      {sittingCustomers.map((c) => (
                        <div
                          key={c._id}
                          className="border rounded p-2 flex justify-between items-center bg-gray-50 hover:bg-gray-100"
                        >
                          <div>
                            <div className="font-medium text-sm">{c.name}</div>
                            <div className="text-xs text-gray-500">{c.phone}</div>
                          </div>
                          <button
                            onClick={() => inviteCustomer(c._id)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-component: Event Create Form ---
function EventCreateForm({ onSubmit, onCancel, type }) {
  const [formData, setFormData] = useState({
    title: "",
    startTime: "10:00",
    endTime: "11:00",
    type: "NORMAL",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Event Title *</label>
        <input
          type="text"
          required
          className="w-full border rounded px-3 py-2 text-sm"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <input
            type="time"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Time</label>
          <input
            type="time"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          className="w-full border rounded px-3 py-2 text-sm"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        >
          <option value="NORMAL">NORMAL (Limit 20)</option>
          <option value="COUPLE">COUPLE (Limit 10)</option>
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800"
        >
          Create Event
        </button>
      </div>
    </form>
  );
}
