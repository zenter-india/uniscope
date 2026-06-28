import { redirect } from 'next/navigation';

// The admin portal entry point routes straight to the dashboard;
// middleware redirects unauthenticated visitors to /login.
export default function Home() {
  redirect('/dashboard');
}
