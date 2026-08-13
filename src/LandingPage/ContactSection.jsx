import React, { useState } from 'react';
import axios from 'axios';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import ENV from "../config";


const CATEGORIES = [
    { label: 'Feedback', value: 'feedback' },
    { label: 'Feature request', value: 'feature_request' },
    { label: 'Something else', value: 'other' },
];

export default function ContactSection() {
    const [category, setCategory] = useState(CATEGORIES[0].value);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!message.trim()) {
            setError("Mind adding a few words? Even one line helps.");
            return;
        }

        setIsSubmitting(true);

        try {
            await axios.post(`${ENV.BASE_API_URL}/api/contact-us`, {
                category,
                email: email.trim() || null,
                message: message.trim(),
            });

            setSubmitted(true);
        } catch (err) {
            console.error('Contact form submit error:', err);
            const apiMessage = err?.response?.data?.message?.[0] ?? err?.response?.data?.detail;
            setError(apiMessage ?? "Something went wrong on our end. Mind trying again?");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <section id="contact" className="w-full bg-[#020617] py-24 px-4 border-t border-slate-800">
                <div className="max-w-lg mx-auto text-center">
                    <Check size={28} className="text-blue-500 mx-auto mb-5" strokeWidth={2.5} />
                    <h2 className="text-white text-3xl md:text-4xl font-bold tracking-tight mb-3">Got it.</h2>
                    <p className="text-slate-400 text-lg">
                        I read every message myself. If you left an email, I'll get back to you.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section id="contact" className="w-full bg-[#020617] py-24 px-4 border-t border-slate-800">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-white text-3xl md:text-4xl font-bold tracking-tight mb-3">
                        Contact Us
                    </h2>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="flex gap-1 mb-8 border border-slate-800 w-fit mx-auto">
                        {CATEGORIES.map((cat) => (
                            <button
                                type="button"
                                key={cat.value}
                                onClick={() => setCategory(cat.value)}
                                aria-pressed={category === cat.value}
                                className={`text-sm font-medium px-4 py-2 transition-colors duration-150 ${category === cat.value
                                    ? 'bg-white text-black'
                                    : 'bg-transparent text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="mb-7">
                        <label htmlFor="contact-email" className="block text-sm text-slate-500 mb-2">
                            Email [optional]
                        </label>
                        <input
                            id="contact-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            disabled={isSubmitting}
                            className="w-full bg-transparent border-0 border-b border-slate-800 px-0 py-3 text-base text-white placeholder-slate-700 focus:outline-none focus:border-white transition-colors disabled:opacity-50"
                        />
                    </div>

                    <div className="mb-8">
                        <label htmlFor="contact-message" className="block text-sm text-slate-500 mb-2">
                            Message
                        </label>
                        <textarea
                            id="contact-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={6}
                            placeholder="What worked, what didn't, what you wish it did..."
                            disabled={isSubmitting}
                            className="w-full bg-transparent border-0 border-b border-slate-800 px-0 py-3 text-base text-white placeholder-slate-700 focus:outline-none focus:border-white transition-colors resize-none disabled:opacity-50"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-400 mb-5" role="alert">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="group inline-flex items-center gap-2 text-base font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                Sending
                                <Loader2 size={18} className="animate-spin" />
                            </>
                        ) : (
                            <>
                                Send
                                <ArrowRight size={18} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </section>
    );
}