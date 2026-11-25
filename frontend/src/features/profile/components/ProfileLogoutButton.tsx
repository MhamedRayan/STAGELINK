import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button, ConfirmDialog } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { S } from '../strings';

/** Quiet log-out control closing every profile action bar; asks for confirmation first. */
export function ProfileLogoutButton() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="link"
        onClick={() => setOpen(true)}
        className="h-10 w-full justify-center gap-2 rounded-[10px] px-3 text-[13px] text-pill-danger-fg hover:bg-pill-danger-bg hover:no-underline sm:ml-auto sm:w-auto"
      >
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
