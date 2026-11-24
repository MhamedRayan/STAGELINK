import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button, ConfirmDialog } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { S } from '../strings';

/** Log-out control shown in every role's profile header; asks for confirmation first. */
export function ProfileLogoutButton() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {S.common.logout}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={S.common.logoutTitle}
        message={S.common.logoutConfirm}
        confirmLabel={S.common.logout}
        destructive
        onConfirm={logout}
      />
    </>
  );
}
