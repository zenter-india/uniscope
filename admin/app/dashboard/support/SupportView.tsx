'use client';

import { useState } from 'react';
import { SupportInbox } from './SupportInbox';
import { TechnicalReportsList } from './TechnicalReportsList';
import type { SupportChannelSummary, TechnicalReport } from './actions';

type Tab = 'conversations' | 'technical';

export function SupportView({
  channels,
  technicalReports,
}: {
  channels: SupportChannelSummary[];
  technicalReports: TechnicalReport[];
}) {
  const [tab, setTab] = useState<Tab>('conversations');
  const openCount = technicalReports.filter((r) => r.status === 'OPEN').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <TabButton active={tab === 'conversations'} onClick={() => setTab('conversations')}>
          Conversations
        </TabButton>
        <TabButton active={tab === 'technical'} onClick={() => setTab('technical')}>
          Technical reports
          {openCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
              {openCount}
            </span>
          )}
        </TabButton>
      </div>

      {tab === 'conversations' ? (
        <SupportInbox initialChannels={channels} />
      ) : (
        <TechnicalReportsList initialReports={technicalReports} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-zinc-900 text-white'
          : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
      }`}
    >
      {children}
    </button>
  );
}
