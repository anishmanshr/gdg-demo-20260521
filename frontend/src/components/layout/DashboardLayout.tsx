import { useState } from 'react';

interface DashboardLayoutProps {
  title: string;
  children: React.ReactNode;
  sidebarLinks?: { label: string; href: string; active: boolean }[];
}

export default function DashboardLayout({ title, children }: DashboardLayoutProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{title}</h1>
      <div className="bg-white rounded-lg shadow p-6">{children}</div>
    </div>
  );
}
