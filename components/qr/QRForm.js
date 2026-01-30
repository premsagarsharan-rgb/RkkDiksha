"use client";

import { useRouter } from "next/navigation";

export default function QRForm({ token }) {
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value,
      phone: form.phone.value,
      gender: form.gender.value,
      age: form.age.value,
      city: form.city.value,
      notes: form.notes.value,
    };

    const res = await fetch("/api/customers/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, qrToken: token })
    });

    if (res.ok) {
      alert("Thank you! Your data has been submitted.");
      router.push("/qr/thanks");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={submit} className="bg-white p-8 rounded shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Customer Registration</h1>
        {/* sab fields */}
        <button type="submit" className="w-full bg-black text-white py-3 rounded mt-4">
          Submit
        </button>
      </form>
    </div>
  );
}
