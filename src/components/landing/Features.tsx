"use client";

import { motion } from "framer-motion";
import { Calendar, Users, FileText, CreditCard, Bell, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

const features = [
  {
    icon: Calendar,
    title: "Smart Appointment Booking",
    description: "Online booking system with real-time slot availability and automated reminders.",
    color: "text-primary-600 bg-primary-100",
  },
  {
    icon: Users,
    title: "Patient Management",
    description: "Comprehensive patient records, history tracking, and seamless care coordination.",
    color: "text-blue-600 bg-blue-100",
  },
  {
    icon: FileText,
    title: "Digital Prescriptions",
    description: "AI-powered prescription system with drug interaction checks and digital delivery.",
    color: "text-purple-600 bg-purple-100",
  },
  {
    icon: CreditCard,
    title: "Billing & Payments",
    description: "Integrated billing, insurance claims, and multiple payment gateway support.",
    color: "text-green-600 bg-green-100",
  },
  {
    icon: Bell,
    title: "Queue Management",
    description: "Real-time OPD queue tracking with token system and patient notifications.",
    color: "text-orange-600 bg-orange-100",
  },
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "HIPAA-compliant with role-based access control and data encryption.",
    color: "text-red-600 bg-red-100",
  },
];

export default function Features() {
  return (
    <section className="py-20 bg-white">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full mb-4">
            <span className="text-sm font-semibold text-primary-700">Features</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-secondary-900 mb-4">
            Everything You Need to Run Your
            <span className="block text-primary-600">Healthcare Facility</span>
          </h2>
          <p className="text-lg text-secondary-600">
            Comprehensive hospital management system with all modules integrated seamlessly
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card variant="elevated" className="h-full hover:-translate-y-1 transition-transform duration-300">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-secondary-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-secondary-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
