import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { resolveUserName, getDemoDirectoryUsers } from '../../demo/directory';
import { Table, Column } from '../../components/ui/Table';

interface DerivedSupervisor {
  id: string;
  name: string;
  department: string;
  assignedCount: number;
}

export const UniversitySupervisors: React.FC = () => {
  const [supervisors, setSupervisors] = useState<DerivedSupervisor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function deriveSupervisors() {
      setIsLoading(true);
      try {
        const internRes = await apiRequest<{ results: any[] }>(
          '/svc/internships/api/internships/',
          { params: { limit: 100 } }
        );

        if (!isMounted) return;
        const internships = internRes.results || [];

        // Count assigned students per supervisor
        const assignedCounts: Record<string, number> = {};
        internships.forEach((i) => {
          if (i.supervisor_user_id) {
            assignedCounts[i.supervisor_user_id] =
              (assignedCounts[i.supervisor_user_id] || 0) + 1;
          }
        });

        // Gather all supervisors from demo directory + any active in internships
        const demoUsers = getDemoDirectoryUsers();
        const supMap: Record<string, DerivedSupervisor> = {};

        // Seeded supervisors
        Object.entries(demoUsers).forEach(([id, u]) => {
          if (u.role === 'supervisor') {
            supMap[id] = {
              id,
              name: u.name,
              department: u.department || 'Academic Faculty',
              assignedCount: assignedCounts[id] || 0,
            };
          }
        });

        // Any additional supervisors found in internships
        Object.keys(assignedCounts).forEach((id) => {
          if (!supMap[id]) {
            supMap[id] = {
              id,
              name: resolveUserName(id, 'Supervisor'),
              department: 'Academic Faculty',
              assignedCount: assignedCounts[id],
            };
          }
        });

        setSupervisors(Object.values(supMap));
      } catch (err) {
        console.error('Failed to load supervisors list:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    deriveSupervisors();
    return () => {
      isMounted = false;
    };
  }, []);

  const columns: Column<DerivedSupervisor>[] = [
    {
      header: 'Supervisor Name',
      accessorKey: 'name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Department / Faculty',
      accessorKey: 'department',
      className: 'text-mutedText text-xs',
    },
    {
      header: 'Assigned Students',
      cell: (item) => `${item.assignedCount} students assigned`,
      className: 'text-forest-900 font-medium',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Supervisors</h1>
          <p className="text-xs text-mutedText mt-1">
            Faculty members available for internship supervision and evaluation.
          </p>
        </div>

        {/* Informational note replacing "+ Add Supervisor" per design-plan §3.4 */}
        <div className="flex items-center gap-2 p-2.5 bg-mint rounded-lg text-xs text-forest-900 border border-mint-300">
          <Info className="w-4 h-4 text-surface-600 shrink-0" />
          <span>Supervisor accounts are provisioned by the platform administrator.</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-mint-300/60 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={supervisors}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No supervisors registered yet."
        />
      </div>
    </div>
  );
};
