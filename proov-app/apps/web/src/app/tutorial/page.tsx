'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TutorialPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem('proov_is_new_user', 'true');
    router.replace('/dashboard');
  }, [router]);

  return null;
}
