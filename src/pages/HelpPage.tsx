import React, { useState } from 'react';
import {
  HelpCircle,
  Mail,
  Send,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquare,
  Sparkles,
  AlertCircle,
  ChevronDown,
  LifeBuoy,
  FileQuestion,
  Lightbulb,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { LitweboBadge } from '../components/LitweboBadge.tsx';

const SUPPORT_EMAIL = 'lifetracko0@gmail.com';

const FAQS = [
  {
    q: 'How does daily calorie & protein tracking work?',
    a: 'Use the Diet tab to log meals or search foods from the food catalog. Your calorie and protein rings update automatically to compare against your customized daily goals.',
  },
  {
    q: 'How is the remaining money balance calculated?',
    a: 'Life Tracko uses a strict ledger formula: Starting Balance − Total Expenses = Remaining Balance. You can adjust your starting cash anytime or use 1-click preset chips.',
  },
  {
    q: 'Who can see my personal nutrition and financial records?',
    a: 'Only you. You have full control in Settings to either allow or deny administrator viewing permissions at any time.',
  },
  {
    q: 'Can I export or backup my data?',
    a: 'Yes, in the Settings tab you can export all your health logs, weight entries, and expenses to a JSON backup file.',
  },
];

export function HelpPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState('General Issue');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<{
    id: number;
    subject: string;
    senderEmail: string;
    senderName: string;
    category: string;
    message: string;
  } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopiedEmail(true);
    toast.success(`Copied ${SUPPORT_EMAIL} to clipboard!`);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const constructEmailContent = (ticketId?: number) => {
    const ticketPrefix = ticketId ? `[Ticket #${ticketId}] ` : '';
    const cleanSubj = subject.trim() || `Problem with ${category}`;
    const emailSubject = `[Life Tracko Help] ${ticketPrefix}${cleanSubj}`;
    
    const emailBody = [
      `Hello Life Tracko Support Team,`,
      ``,
      `I am reporting an issue with Life Tracko from my account.`,
      ``,
      `----------------------------------------`,
      `SENDER DETAILS:`,
      `Name: ${name.trim() || user?.name || 'User'}`,
      `Registered Email: ${email.trim() || user?.email || 'Not specified'}`,
      `Category: ${category}`,
      ticketId ? `Ticket Reference: #${ticketId}` : ``,
      `Date & Time: ${new Date().toLocaleString()}`,
      `----------------------------------------`,
      ``,
      `PROBLEM DESCRIPTION:`,
      `${message.trim() || '(No problem details provided)'}`,
      ``,
      `----------------------------------------`,
      `Please assist me in resolving this issue.`,
      `Sent via Life Tracko Help Center`,
    ].filter(Boolean).join('\n');

    return { emailSubject, emailBody };
  };

  const handleOpenGmailWeb = (ticketId?: number) => {
    const { emailSubject, emailBody } = constructEmailContent(ticketId);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      SUPPORT_EMAIL
    )}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDirectEmailClient = (ticketId?: number) => {
    const { emailSubject, emailBody } = constructEmailContent(ticketId);
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(
      emailBody
    )}`;
    window.location.href = mailtoUrl;
  };

  const handleCopyFormattedReport = () => {
    const { emailSubject, emailBody } = constructEmailContent(submittedTicket?.id);
    const fullText = `To: ${SUPPORT_EMAIL}\nSubject: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(fullText);
    setCopiedBody(true);
    toast.success('Formatted problem report copied to clipboard!');
    setTimeout(() => setCopiedBody(false), 2500);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !message.trim()) {
      toast.error('Please provide both your email address and describe the problem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim() || `Problem in ${category}`,
          category,
          message: message.trim(),
          userId: user?.id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit problem.');
        return;
      }

      toast.success(`Problem recorded & prepared for ${SUPPORT_EMAIL}!`);
      const newTicket = {
        id: data.ticketId,
        subject: subject.trim() || category,
        senderEmail: email.trim(),
        senderName: name.trim() || user?.name || 'User',
        category,
        message: message.trim(),
      };
      setSubmittedTicket(newTicket);
    } catch (err) {
      console.error('Support ticket submission error:', err);
      toast.error('Network error submitting ticket. Opening direct email client...');
      handleOpenGmailWeb();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 shadow-xl border border-slate-700/50">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-400 text-xs font-semibold border border-white/10">
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Help & Support Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Need Help? Send Us Your Problem
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Describe any issues, questions, or bugs you encounter. Your report is directly routed to{' '}
              <span className="text-emerald-400 font-semibold">{SUPPORT_EMAIL}</span>.
            </p>
          </div>

          {/* Quick Direct Email Pill */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Direct Email</p>
                <p className="text-sm font-bold text-white font-mono">{SUPPORT_EMAIL}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                title="Copy Email"
              >
                {copiedEmail ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleDirectEmailClient}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                title="Open Mail Client"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Mail</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Support Problem Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Report a Problem</h2>
                  <p className="text-xs text-slate-500">We respond promptly to help resolve your issue</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                To: {SUPPORT_EMAIL}
              </span>
            </div>

            {submittedTicket && (
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-sm space-y-3 animate-in fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 font-bold shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                          Problem Ticket Logged (#{submittedTicket.id})
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
                        Your issue report is ready to be sent to <strong>{SUPPORT_EMAIL}</strong> from your email:{' '}
                        <strong className="font-mono">{submittedTicket.senderEmail}</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSubmittedTicket(null)}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
                  >
                    Dismiss
                  </button>
                </div>

                {/* 1-Click Launch Actions */}
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenGmailWeb(submittedTicket.id)}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send via Gmail Web</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectEmailClient(submittedTicket.id)}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Open in Default Mail App</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyFormattedReport}
                    className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    {copiedBody ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBody ? 'Copied' : 'Copy Full Message'}</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Issue Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="General Issue">General Issue</option>
                    <option value="Diet & Calorie Tracking">Diet & Calorie Tracking</option>
                    <option value="Expense & Money Ledger">Expense & Money Ledger</option>
                    <option value="Login & Authentication">Login & Authentication</option>
                    <option value="Data Sync / Database">Data Sync / Database</option>
                    <option value="Feature Request">Feature Request / Suggestion</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Subject / Short Summary
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Issue adding custom food item"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Describe The Problem You Are Facing <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe what happened, what you expected, and any error messages you see..."
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-sm text-slate-950 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Sending Ticket...' : 'Send Problem to Email'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenGmailWeb()}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send with Gmail</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectEmailClient()}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                >
                  <ExternalLink className="w-4 h-4 text-emerald-500" />
                  <span>Email App</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Direct Contacts & FAQs */}
        <div className="lg:col-span-5 space-y-6">
          {/* Creator & Direct Help Contacts */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Direct Support Channels
            </h3>

            <div className="space-y-3">
              {/* Email Contact Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Official Support Email</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate font-mono">
                      {SUPPORT_EMAIL}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors shrink-0"
                >
                  {copiedEmail ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Creator & Developer Card with Cool Litwebo Effects */}
              <LitweboBadge variant="card" />
            </div>
          </div>

          {/* Quick FAQ Accordion */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileQuestion className="w-4 h-4 text-indigo-500" />
              Frequently Asked Questions
            </h3>

            <div className="space-y-2.5">
              {FAQS.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full p-3.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-emerald-500' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
