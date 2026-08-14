import { redirect } from 'next/navigation';
import { readFileSync } from 'fs';
import path from 'path';

export default function NotFound() {
  // In Next.js App Router, we can redirect to our static 404.html
  redirect('/404.html');
}
