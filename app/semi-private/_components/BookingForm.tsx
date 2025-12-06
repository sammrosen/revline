'use client';

import { useState, FormEvent } from 'react';

export default function BookingForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    memberStatus: '',
    preferredDays: [] as string[],
    mainGoal: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const trainingDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      newErrors.email = 'Valid email is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (!formData.memberStatus) {
      newErrors.memberStatus = 'Please select member status';
    }
    if (formData.preferredDays.length === 0) {
      newErrors.preferredDays = 'Please select at least one preferred day';
    }
    if (!formData.mainGoal.trim()) {
      newErrors.mainGoal = 'Please tell us your main goal';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Form does nothing - just show thank you message
    setSubmitted(true);
  };

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredDays: prev.preferredDays.includes(day)
        ? prev.preferredDays.filter((d) => d !== day)
        : [...prev.preferredDays, day],
    }));
  };

  if (submitted) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 md:p-12 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-zinc-50">Thank You!</h3>
          <p className="text-zinc-400 leading-relaxed">
            Thanks – I&apos;ve got your details. I&apos;ll reach out within 24–48 hours to confirm your planning session time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-zinc-400 mb-2">
            First Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
            placeholder="John"
          />
          {errors.firstName && <p className="mt-1 text-sm text-red-400">{errors.firstName}</p>}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-zinc-400 mb-2">
            Last Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
            placeholder="Doe"
          />
          {errors.lastName && <p className="mt-1 text-sm text-red-400">{errors.lastName}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-2">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
            placeholder="john@example.com"
          />
          {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-400 mb-2">
            Phone <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
            placeholder="(555) 123-4567"
          />
          {errors.phone && <p className="mt-1 text-sm text-red-400">{errors.phone}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="memberStatus" className="block text-sm font-medium text-zinc-400 mb-2">
          Are you a current Sports West member? <span className="text-red-400">*</span>
        </label>
        <select
          id="memberStatus"
          value={formData.memberStatus}
          onChange={(e) => setFormData({ ...formData, memberStatus: e.target.value })}
          className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
        >
          <option value="">Select...</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
        {errors.memberStatus && <p className="mt-1 text-sm text-red-400">{errors.memberStatus}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Preferred Training Days <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {trainingDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => handleDayToggle(day)}
              className={`px-4 py-3 rounded-lg border transition-all duration-200 ${
                formData.preferredDays.includes(day)
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-50'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        {errors.preferredDays && <p className="mt-1 text-sm text-red-400">{errors.preferredDays}</p>}
      </div>

      <div>
        <label htmlFor="mainGoal" className="block text-sm font-medium text-zinc-400 mb-2">
          What&apos;s your main goal for the next 8–12 weeks? <span className="text-red-400">*</span>
        </label>
        <textarea
          id="mainGoal"
          value={formData.mainGoal}
          onChange={(e) => setFormData({ ...formData, mainGoal: e.target.value })}
          rows={4}
          className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg resize-none"
          placeholder="I want to build strength and lose body fat..."
        />
        {errors.mainGoal && <p className="mt-1 text-sm text-red-400">{errors.mainGoal}</p>}
      </div>

      <button
        type="submit"
        className="w-full px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-100 transition-all duration-200 shadow-lg shadow-white/10 hover:shadow-white/20"
      >
        Request a Planning Session
      </button>
    </form>
  );
}


