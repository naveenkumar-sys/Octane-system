import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Database } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export const PlaceholderPage = ({ title, description, moduleCode, icon: Icon, onNavigate }) => {
  return (
    <div className="space-y-8">
      {/* Module Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="p-3.5 rounded-xl bg-orange-100 border border-orange-200 text-orange-600">
              <Icon size={28} />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md bg-orange-100 text-orange-800 border border-orange-200">
                MODULE: {moduleCode || 'OCTANE-UI'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
        </div>
      </div>

      {/* Placeholder Content Area */}
      <Card className="p-12 text-center border-dashed border-slate-300 bg-white">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 border border-orange-300 text-white flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
            <Database size={32} />
          </div>

          <h3 className="text-lg font-extrabold text-slate-900 mb-2">
            Module Architecture & API Ready
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            The frontend application shell and reusable design system foundation are established in the <strong className="text-orange-600">Bright Orange Theme</strong>. Backend endpoints for <strong className="text-slate-800">{title}</strong> are frozen and tested. Business UI view implementation will follow in the next module phase.
          </p>

          <div className="flex items-center gap-2 text-xs text-slate-600 font-mono bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Django REST API Connected • DB Ledger Ready</span>
          </div>
        </div>
      </Card>

      {/* Structural Metric Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card title="Module Status" subtitle="Backend Endpoint State">
          <div className="text-xl font-mono font-bold text-emerald-600">REST API Frozen</div>
          <p className="text-xs text-slate-500 mt-1">100% database models & serializers verified</p>
        </Card>

        <Card title="Frontend Layout" subtitle="Component Shell Standard">
          <div className="text-xl font-mono font-bold text-orange-600">Bright Theme V2</div>
          <p className="text-xs text-slate-500 mt-1">Uses standard Card, Table, Form & Badge UI</p>
        </Card>

        <Card title="Next Action" subtitle="Target Phase">
          <div className="text-xl font-mono font-bold text-amber-600">Ready for Build</div>
          <p className="text-xs text-slate-500 mt-1">Will mount seamlessly into this shell</p>
        </Card>
      </div>
    </div>
  );
};

export default PlaceholderPage;
