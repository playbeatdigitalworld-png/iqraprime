import React, { useState } from 'react';
import { Channel } from '../../types/playbeat';
import { 
  Calendar, 
  Search, 
  Clock, 
  Bell, 
  BellRing, 
  Play, 
  ChevronRight, 
  Info,
  Tv
} from 'lucide-react';
import { ChannelLogo } from '../common/ChannelLogo';

interface EpgGuideViewProps {
  channels: Channel[];
  onWatchChannel: (channel: Channel) => void;
}

export const EpgGuideView: React.FC<EpgGuideViewProps> = ({ channels, onWatchChannel }) => {
  const [timeFilter, setTimeFilter] = useState<'NOW' | 'TONIGHT' | 'TOMORROW' | 'WEEK'>('NOW');
  const [searchQuery, setSearchQuery] = useState('');
  const [reminders, setReminders] = useState<string[]>([]);
  const [selectedProgramDetail, setSelectedProgramDetail] = useState<{
    channel: Channel;
    title: string;
    time: string;
    synopsis: string;
  } | null>(null);

  const toggleReminder = (programTitle: string) => {
    if (reminders.includes(programTitle)) {
      setReminders(reminders.filter((r) => r !== programTitle));
    } else {
      setReminders([...reminders, programTitle]);
    }
  };

  const filteredChannels = channels.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.currentProgram.title.toLowerCase().includes(q) ||
      c.nextProgram.title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-cyan-400" />
            <span>PlayBeat Electronic Program Guide (EPG)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time synchronized 7-day broadcast schedules for authorized channels
          </p>
        </div>

        {/* Time filters & search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#0c1326] border border-white/10 rounded-xl">
            {(['NOW', 'TONIGHT', 'TOMORROW', 'WEEK'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  timeFilter === t
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'NOW' ? 'On Now' : t === 'TONIGHT' ? 'Tonight' : t === 'TOMORROW' ? 'Tomorrow' : '7-Day'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search programs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0c1326] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Guide Timeline Table */}
      <div className="bg-[#0c1326]/80 border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#050811]/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-5 w-60">Channel</th>
                <th className="py-3 px-5">Currently Airing</th>
                <th className="py-3 px-5">Next Program</th>
                <th className="py-3 px-5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredChannels.map((ch) => {
                const isCurrentReminded = reminders.includes(ch.currentProgram.title);
                const isNextReminded = reminders.includes(ch.nextProgram.title);

                return (
                  <tr key={ch.id} className="hover:bg-white/[0.02] transition-colors group">
                    {/* Channel */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <ChannelLogo
                          src={ch.logo}
                          name={ch.name}
                          category={ch.category}
                          size="md"
                        />
                        <div>
                          <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {ch.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            CH {ch.number} · {ch.category}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Currently Airing */}
                    <td className="py-4 px-5">
                      <div className="space-y-1.5 max-w-md">
                        <div className="flex items-center justify-between">
                          <span
                            onClick={() =>
                              setSelectedProgramDetail({
                                channel: ch,
                                title: ch.currentProgram.title,
                                time: `${ch.currentProgram.startTime} - ${ch.currentProgram.endTime}`,
                                synopsis: ch.currentProgram.synopsis || 'Live broadcast.'
                              })
                            }
                            className="font-bold text-slate-200 hover:text-cyan-400 cursor-pointer"
                          >
                            {ch.currentProgram.title}
                          </span>
                          <span className="font-mono text-[10px] text-cyan-400">
                            {ch.currentProgram.startTime} - {ch.currentProgram.endTime}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-cyan-400 h-full rounded-full"
                            style={{ width: `${ch.currentProgram.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Next Program */}
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-between max-w-sm">
                        <span className="text-slate-300 truncate mr-2">
                          {ch.nextProgram.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[10px] text-slate-400">
                            {ch.nextProgram.startTime}
                          </span>
                          <button
                            onClick={() => toggleReminder(ch.nextProgram.title)}
                            className={`p-1 rounded transition-colors ${
                              isNextReminded ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title={isNextReminded ? 'Reminder active' : 'Set program reminder'}
                          >
                            {isNextReminded ? <BellRing className="w-3.5 h-3.5 text-cyan-400" /> : <Bell className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Quick Action: Watch Live */}
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => onWatchChannel(ch)}
                        className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Program Details Modal */}
      {selectedProgramDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0c1326] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-400">
                {selectedProgramDetail.channel.name} · {selectedProgramDetail.time}
              </span>
              <button
                onClick={() => setSelectedProgramDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <h3 className="text-lg font-bold text-white font-display">
              {selectedProgramDetail.title}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedProgramDetail.synopsis}
            </p>

            <div className="pt-2 flex justify-end gap-3 border-t border-white/10">
              <button
                onClick={() => {
                  toggleReminder(selectedProgramDetail.title);
                  setSelectedProgramDetail(null);
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold"
              >
                {reminders.includes(selectedProgramDetail.title) ? 'Remove Reminder' : 'Set Reminder'}
              </button>

              <button
                onClick={() => {
                  onWatchChannel(selectedProgramDetail.channel);
                  setSelectedProgramDetail(null);
                }}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Watch Channel Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
