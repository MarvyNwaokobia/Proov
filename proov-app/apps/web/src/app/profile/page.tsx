'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    const addr = localStorage.getItem('proov_address');
    if (addr) router.replace(`/profile/${addr}`);
    else router.replace('/');
  }, [router]);
  return null;
}
