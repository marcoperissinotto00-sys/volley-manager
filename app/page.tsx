import { redirect } from 'next/navigation';

export default function Home() {
  // Reindirizza automaticamente chi visita la Home alla pagina dei giocatori
  redirect('/players');
}