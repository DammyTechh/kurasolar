import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from './ui/Misc';

export function SuccessCard({ title, text, children }: { title: string; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="container-page py-16">
      <Card className="max-w-lg p-8">
        <CheckCircle2 className="size-9 text-success" />
        <h1 className="mt-4 text-2xl">{title}</h1>
        <p className="mt-2 text-muted">{text}</p>
        {children && <div className="mt-6 flex flex-wrap gap-2">{children}</div>}
      </Card>
    </div>
  );
}
