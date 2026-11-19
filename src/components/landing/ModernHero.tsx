"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, CheckCircle, Star } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const stats = [
  { label: "Hospitals", value: "500+" },
  { label: "Patients", value: "1M+" },
  { label: "Appointments", value: "2M+" },
];

export default function ModernHero() {
  return (
    <section className="relative pt-20 pb-32 overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute top-60 -left-40 w-96 h-96 bg-accent-blue/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full mb-6">
              <span className="w-2 h-2 bg-primary-600 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-primary-700">
                AI-Powered Hospital Management
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-secondary-900 leading-tight mb-6">
              Smarter Healthcare
              <span className="block text-primary-600">Management Platform</span>
            </h1>

            <p className="text-lg text-secondary-600 mb-8 leading-relaxed">
              Streamline OPD queues, appointments, billing, and patient care with our all-in-one
              hospital management SaaS. Built for clinics, hospitals, and healthcare networks.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup" className="group">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/book">
                  <Calendar className="w-5 h-5" />
                  Book Demo
                </Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-6 mb-8">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-warning-500 text-warning-500" />
                ))}
              </div>
              <div className="text-sm text-secondary-600">
                <span className="font-semibold text-secondary-900">4.9/5</span> from 500+ hospitals
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-secondary-200">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl md:text-3xl font-extrabold text-primary-600">
                    {stat.value}
                  </div>
                  <div className="text-sm text-secondary-600 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Content - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative">
              {/* Main Dashboard Card */}
              <div className="bg-white rounded-2xl shadow-2xl border border-secondary-200 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <span className="text-white font-bold">clickmyQ+ Dashboard</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/40" />
                    <div className="w-3 h-3 rounded-full bg-white/40" />
                    <div className="w-3 h-3 rounded-full bg-white" />
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-primary-50 p-4 rounded-xl">
                      <div className="text-primary-700 text-sm font-medium mb-1">Today's OPD</div>
                      <div className="text-2xl font-bold text-primary-900">24</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl">
                      <div className="text-blue-700 text-sm font-medium mb-1">Appointments</div>
                      <div className="text-2xl font-bold text-blue-900">18</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl">
                      <div className="text-green-700 text-sm font-medium mb-1">Completed</div>
                      <div className="text-2xl font-bold text-green-900">16</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                          P{i}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-secondary-900">Patient {i}</div>
                          <div className="text-sm text-secondary-600">Dr. Sharma • 10:{i}0 AM</div>
                        </div>
                        <span className="px-3 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                          In Queue
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Card 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute -left-8 top-20 bg-white p-4 rounded-xl shadow-xl border border-secondary-200 hidden lg:flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="font-semibold text-secondary-900">Appointment Confirmed</div>
                  <div className="text-sm text-secondary-600">Instant notifications</div>
                </div>
              </motion.div>

              {/* Floating Card 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="absolute -right-8 bottom-32 bg-white p-4 rounded-xl shadow-xl border border-secondary-200 hidden lg:flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <div className="font-semibold text-secondary-900">Smart Scheduling</div>
                  <div className="text-sm text-secondary-600">AI-powered slots</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
