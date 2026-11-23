import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, CheckSquare, PlusCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';
import { StatCard } from '../../components/ui/StatCard';
import { SectionCard } from '../../components/ui/SectionCard';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../utils/formatters';

interface CompanyRecord {
  user_id: string;
  name: string;
  email: string;
  legal_name?: string;
  address?: string;
  verification_status: string;
  created_at: string;
}

export const PlatformDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingCompanies, setPendingCompanies] = useState<CompanyRecord[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeCompaniesCount, setActiveCompaniesCount] = useState<number>(0);
  const [uniAccountsCount, setUniAccountsCount] = useState<number>(0);
  const [studentAccountsCount, setStudentAccountsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadPlatformData() {
      setIsLoading(true);
      try {
        const [pendingRes, activeRes, uniRes, studentRes] = await Promise.allSettled([
          apiRequest<{ count: number; results: CompanyRecord[] }>('/svc/identity/api/admin/companies/', {
            params: { status: 'pending' },
          }),
          apiRequest<{ count: number }>('/svc/identity/api/admin/companies/', {
            params: { status: 'active' },
          }),
          apiRequest<{ count: number }>('/svc/identity/api/admin/users/', {
            params: { role: 'university_admin' },
          }),
          apiRequest<{ count: number }>('/svc/identity/api/admin/users/', {
            params: { role: 'student' },
          }),
        ]);

        if (!isMounted) return;

        if (pendingRes.status === 'fulfilled' && pendingRes.value) {
          setPendingCompanies(pendingRes.value.results || []);
          setPendingCount(pendingRes.value.count || 0);
        }

        if (activeRes.status === 'fulfilled' && activeRes.value) {
          setActiveCompaniesCount(activeRes.value.count || 0);
        }

        if (uniRes.status === 'fulfilled' && uniRes.value) {
          setUniAccountsCount(uniRes.value.count || 0);
        }

        if (studentRes.status === 'fulfilled' && studentRes.value) {
          setStudentAccountsCount(studentRes.value.count || 0);
        }
      } catch (err) {
        console.error('Failed to load platform dashboard:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPlatformData();
    return () => {
      isMounted = false;
    };
  }, []);

  const columns: Column<CompanyRecord>[] = [
    {
      header: 'Company Name',
      cell: (item) => (
        <div>
          <div className="font-semibold text-forest-900">{item.name || item.legal_name}</div>
          <div className="text-[11px] text-mutedText">{item.email}</div>
        </div>
      ),
    },
    {
      header: 'Location / Address',
      cell: (item) => item.address || 'Not provided',
      className: 'text-mutedText text-xs',
    },
    {
      header: 'Registered on',
      cell: (item) => formatDate(item.created_at),
      className: 'text-mutedText text-xs',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.verification_status} type="verification" />,
    },
    {
      header: 'Action',
      className: 'text-right',
      cell: () => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate('/app/platform/companies')}
          className="text-xs text-surface-700"
        >
          Review →
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
            Platform Administration
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Welcome, {user?.name || 'Administrator'}. Manage company verifications and provision institutional accounts.
          </p>
        </div>

        <Button
          onClick={() => navigate('/app/platform/accounts/new')}
          className="shrink-0"
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Create Accounts
        </Button>
      </div>

      {/* 4-up Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Verifications"
          value={isLoading ? '-' : pendingCount}
          hint={pendingCount > 0 ? 'Requires action' : 'All clear'}
          icon={<CheckSquare className="w-5 h-5" />}
        />
        <StatCard
          label="Active Verified Companies"
          value={isLoading ? '-' : activeCompaniesCount}
          hint="Approved partners"
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          label="University Admins"
          value={isLoading ? '-' : uniAccountsCount}
          hint="Institutional administrators"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Student Accounts"
          value={isLoading ? '-' : studentAccountsCount}
          hint="Registered students"
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Companies Awaiting Verification */}
      <SectionCard
        title="Companies Awaiting Verification"
        subtitle="Newly registered companies requiring validation before they can post offers"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/app/platform/companies')}
            className="text-xs text-surface-700"
          >
            Review all verifications <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        }
      >
        <Table
          columns={columns}
          data={pendingCompanies.slice(0, 5)}
          keyExtractor={(item) => item.user_id}
          isLoading={isLoading}
          emptyMessage="No companies currently awaiting verification."
        />
      </SectionCard>
    </div>
  );
};
