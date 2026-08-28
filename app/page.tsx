import { redirect } from 'next/navigation';

export default function Home() {
  // Reindirizza automaticamente chi visita la Home al calendario appuntamenti
  redirect('/calendar');
}