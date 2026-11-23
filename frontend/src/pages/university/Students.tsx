import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { resolveUserName, resolveUserMatricule } from '../../demo/directory';
import { Table, Column } from '../../components/ui/Table';

interface DerivedStudent {
  id: string;
  name: string;
  matricule: string;
  applicationsCount: number;
  hasInternship: boolean;
  internshipStatus?: string;
}

export const UniversityStudents: React.FC = () => {
  const [students, setStudents] = useState<DerivedStudent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function deriveStudents() {
      setIsLoading(true);
      try {
        const [appsRes, internRes] = await Promise.all([
          apiRequest<{ results: any[] }>('/svc/applications/api/applications/', {
            params: { limit: 100 },
          }),
          apiRequest<{ results: any[] }>('/svc/internships/api/internships/', {
            params: { limit: 100 },
          }),
        ]);

        if (!isMounted) return;

        const apps = appsRes.results || [];
        const internships = internRes.results || [];

        const studentMap: Record<string, DerivedStudent> = {};

        // Aggregate from applications
        apps.forEach((a) => {
          const sId = a.student_user_id;
          if (!studentMap[sId]) {
            studentMap[sId] = {
              id: sId,
              name: resolveUserName(sId, 'Student'),
              matricule: resolveUserMatricule(sId),
              applicationsCount: 0,
              hasInternship: false,
            };
          }
          studentMap[sId].applicationsCount += 1;
        });

        // Aggregate from internships
        internships.forEach((i) => {
          const sId = i.student_user_id;
          if (!studentMap[sId]) {
            studentMap[sId] = {
              id: sId,
              name: resolveUserName(sId, 'Student'),
              matricule: resolveUserMatricule(sId),
              applicationsCount: 0,
              hasInternship: true,
              internshipStatus: i.status,
            };
          } else {
            studentMap[sId].hasInternship = true;
            studentMap[sId].internshipStatus = i.status;
          }
        });

        setStudents(Object.values(studentMap));
      } catch (err) {
        console.error('Failed to load students list:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    deriveStudents();
    return () => {
      isMounted = false;
    };
  }, []);

  const columns: Column<DerivedStudent>[] = [
    {
      header: 'Student Name',
      accessorKey: 'name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Student ID (Matricule)',
      accessorKey: 'matricule',
      className: 'text-mutedText font-mono text-xs',
    },
    {
      header: 'Submitted Applications',
      cell: (item) => `${item.applicationsCount} applications`,
      className: 'text-mutedText',
    },
    {
      header: 'Placement Status',
      cell: (item) => (
        <span className="text-xs font-medium text-forest-900">
          {item.hasInternship
            ? `Internship (${item.internshipStatus?.toUpperCase()})`
            : 'Applying / No Placement'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Students</h1>
          <p className="text-xs text-mutedText mt-1">
            Overview of active students enrolled and participating in internship workflows.
          </p>
        </div>

        {/* Informational note replacing "+ Add Student" per design-plan §3.4 */}
        <div className="flex items-center gap-2 p-2.5 bg-mint rounded-lg text-xs text-forest-900 border border-mint-300">
          <Info className="w-4 h-4 text-surface-600 shrink-0" />
          <span>Student accounts are provisioned by the platform administrator.</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-mint-300/60 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={students}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No active students found in current applications or internships."
        />
      </div>
    </div>
  );
};
