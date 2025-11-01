// src/app/teams/[teamId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import type { Game, TeamEvent } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';

interface Team {
  id: string;
  name: string;
  level: string;
  colors: {
    primary?: string;
    secondary?: string;
  };
}

type CalendarItem = (Game & { itemType: 'game' }) | (TeamEvent & { itemType: 'event' });

type EventFormData = {
  event_type: 'practice' | 'meeting' | 'other';
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
};

type GameFormData = {
  name: string;
  opponent: string;
  date: string;
  start_time: string;
  location: string;
  notes: string;
};

export default function TeamSchedulePage({ params }: { params: { teamId: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TeamEvent | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [newEventDate, setNewEventDate] = useState<string>('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [params.teamId]);

  const fetchData = async () => {
    try {
      // Fetch team info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', params.teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch games
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', params.teamId)
        .order('date', { ascending: true });

      setGames(gamesData || []);

      // Fetch events
      const { data: eventsData } = await supabase
        .from('team_events')
        .select('*')
        .eq('team_id', params.teamId)
        .order('date', { ascending: true });

      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWinLossRecord = () => {
    const wins = games.filter(g => g.game_result === 'win').length;
    const losses = games.filter(g => g.game_result === 'loss').length;
    const ties = games.filter(g => g.game_result === 'tie').length;
    return { wins, losses, ties };
  };

  const getItemsForDate = (date: Date): CalendarItem[] => {
    const dateStr = formatDateForComparison(date);

    const gameItems: CalendarItem[] = games
      .filter(g => g.date && formatDateForComparison(new Date(g.date)) === dateStr)
      .map(g => ({ ...g, itemType: 'game' as const }));

    const eventItems: CalendarItem[] = events
      .filter(e => e.date && formatDateForComparison(new Date(e.date)) === dateStr)
      .map(e => ({ ...e, itemType: 'event' as const }));

    return [...gameItems, ...eventItems].sort((a, b) => {
      const timeA = a.itemType === 'game' ? a.start_time : (a as TeamEvent).start_time;
      const timeB = b.itemType === 'game' ? b.start_time : (b as TeamEvent).start_time;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.localeCompare(timeB);
    });
  };

  const hasItemsOnDate = (date: Date): boolean => {
    return getItemsForDate(date).length > 0;
  };

  const getHolidayForDate = (date: Date): string | null => {
    const month = date.getMonth(); // 0-11
    const day = date.getDate();
    const year = date.getFullYear();
    const dayOfWeek = date.getDay(); // 0 = Sunday

    // Fixed date holidays
    if (month === 0 && day === 1) return "New Year's Day";
    if (month === 6 && day === 4) return "Independence Day";
    if (month === 10 && day === 11) return "Veterans Day";
    if (month === 11 && day === 25) return "Christmas";
    if (month === 11 && day === 31) return "New Year's Eve";

    // MLK Day - 3rd Monday in January
    if (month === 0 && dayOfWeek === 1) {
      const mondayCount = Math.ceil(day / 7);
      if (mondayCount === 3) return "MLK Day";
    }

    // Presidents' Day - 3rd Monday in February
    if (month === 1 && dayOfWeek === 1) {
      const mondayCount = Math.ceil(day / 7);
      if (mondayCount === 3) return "Presidents' Day";
    }

    // Memorial Day - Last Monday in May
    if (month === 4 && dayOfWeek === 1) {
      const nextWeek = new Date(date);
      nextWeek.setDate(day + 7);
      if (nextWeek.getMonth() !== 4) return "Memorial Day";
    }

    // Labor Day - 1st Monday in September
    if (month === 8 && dayOfWeek === 1 && day <= 7) {
      return "Labor Day";
    }

    // Columbus Day - 2nd Monday in October
    if (month === 9 && dayOfWeek === 1) {
      const mondayCount = Math.ceil(day / 7);
      if (mondayCount === 2) return "Columbus Day";
    }

    // Thanksgiving - 4th Thursday in November
    if (month === 10 && dayOfWeek === 4) {
      const thursdayCount = Math.ceil(day / 7);
      if (thursdayCount === 4) return "Thanksgiving";
    }

    return null;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowAddMenu(false);
  };

  const handleAddEventClick = (type: 'game' | 'event') => {
    const dateStr = selectedDate ? formatDateForInput(selectedDate) : formatDateForInput(new Date());
    setNewEventDate(dateStr);

    if (type === 'game') {
      setEditingGame(null);
      setShowGameModal(true);
    } else {
      setEditingEvent(null);
      setShowEventModal(true);
    }
    setShowAddMenu(false);
  };

  const handleCreateEvent = async (formData: EventFormData) => {
    try {
      const { error } = await supabase
        .from('team_events')
        .insert({
          team_id: params.teamId,
          ...formData
        });

      if (error) throw error;
      await fetchData();
      setShowEventModal(false);
      setNewEventDate('');
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Error creating event');
    }
  };

  const handleUpdateEvent = async (eventId: string, formData: EventFormData) => {
    try {
      const { error } = await supabase
        .from('team_events')
        .update(formData)
        .eq('id', eventId);

      if (error) throw error;
      await fetchData();
      setShowEventModal(false);
      setEditingEvent(null);
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Error updating event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('team_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error deleting event');
    }
  };

  const handleCreateGame = async (formData: GameFormData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('games')
        .insert({
          team_id: params.teamId,
          user_id: userData.user?.id,
          ...formData
        });

      if (error) throw error;
      await fetchData();
      setShowGameModal(false);
      setNewEventDate('');
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Error creating game');
    }
  };

  const handleUpdateGame = async (gameId: string, formData: GameFormData) => {
    try {
      const { error } = await supabase
        .from('games')
        .update(formData)
        .eq('id', gameId);

      if (error) throw error;
      await fetchData();
      setShowGameModal(false);
      setEditingGame(null);
    } catch (error) {
      console.error('Error updating game:', error);
      alert('Error updating game');
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Error deleting game');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading schedule...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Team not found</div>
          <button
            onClick={() => router.push('/teams')}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  const record = getWinLossRecord();
  const winPercentage = record.wins + record.losses > 0
    ? ((record.wins / (record.wins + record.losses)) * 100).toFixed(0)
    : '0';
  const selectedItems = selectedDate ? getItemsForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Tabs */}
      <TeamNavigation
        team={team}
        teamId={params.teamId}
        currentPage="schedule"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Content - Two Column Layout */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar - Left Column (2/3 width) */}
          <div className="lg:col-span-2">
            <MonthlyCalendar
              currentDate={currentDate}
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
              onMonthChange={setCurrentDate}
              hasItemsOnDate={hasItemsOnDate}
              getHolidayForDate={getHolidayForDate}
            />
          </div>

          {/* Details Panel - Right Column (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedDate
                      ? formatDateDisplay(selectedDate)
                      : 'Select a day'}
                  </h3>
                </div>

                {/* Content */}
                <div className="p-6">
                  {!selectedDate ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-4">Click on a day to view or add events</p>
                    </div>
                  ) : selectedItems.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-6">No events scheduled</p>
                      <button
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        + Add Event
                      </button>

                      {showAddMenu && (
                        <div className="mt-3 space-y-2">
                          <button
                            onClick={() => handleAddEventClick('game')}
                            className="w-full px-4 py-2 text-sm text-left border border-gray-200 rounded hover:bg-gray-50"
                          >
                            Add Game
                          </button>
                          <button
                            onClick={() => handleAddEventClick('event')}
                            className="w-full px-4 py-2 text-sm text-left border border-gray-200 rounded hover:bg-gray-50"
                          >
                            Add Practice/Event
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Add Event Button */}
                      <div className="mb-4">
                        <button
                          onClick={() => setShowAddMenu(!showAddMenu)}
                          className="w-full px-4 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                        >
                          + Add Another Event
                        </button>

                        {showAddMenu && (
                          <div className="mt-2 space-y-2">
                            <button
                              onClick={() => handleAddEventClick('game')}
                              className="w-full px-4 py-2 text-sm text-left border border-gray-200 rounded hover:bg-gray-50"
                            >
                              Add Game
                            </button>
                            <button
                              onClick={() => handleAddEventClick('event')}
                              className="w-full px-4 py-2 text-sm text-left border border-gray-200 rounded hover:bg-gray-50"
                            >
                              Add Practice/Event
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Event Items */}
                      {selectedItems.map((item) => (
                        <div key={item.id}>
                          {item.itemType === 'game' ? (
                            <GameDetailCard
                              game={item as Game}
                              onEdit={(game) => {
                                setEditingGame(game);
                                setShowGameModal(true);
                              }}
                              onDelete={handleDeleteGame}
                              onViewFilm={() => router.push(`/film/${item.id}`)}
                            />
                          ) : (
                            <EventDetailCard
                              event={item as TeamEvent}
                              onEdit={(event) => {
                                setEditingEvent(event);
                                setShowEventModal(true);
                              }}
                              onDelete={handleDeleteEvent}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          initialDate={newEventDate}
          onSave={(data) => {
            if (editingEvent) {
              handleUpdateEvent(editingEvent.id, data);
            } else {
              handleCreateEvent(data);
            }
          }}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
            setNewEventDate('');
          }}
        />
      )}

      {/* Game Modal */}
      {showGameModal && (
        <GameModal
          game={editingGame}
          initialDate={newEventDate}
          onSave={(data) => {
            if (editingGame) {
              handleUpdateGame(editingGame.id, data);
            } else {
              handleCreateGame(data);
            }
          }}
          onClose={() => {
            setShowGameModal(false);
            setEditingGame(null);
            setNewEventDate('');
          }}
        />
      )}
    </div>
  );
}

// Monthly Calendar Component
function MonthlyCalendar({
  currentDate,
  selectedDate,
  onDateClick,
  onMonthChange,
  hasItemsOnDate,
  getHolidayForDate
}: {
  currentDate: Date;
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  hasItemsOnDate: (date: Date) => boolean;
  getHolidayForDate: (date: Date) => string | null;
}) {
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const goToPreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const goToToday = () => {
    onMonthChange(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDateForComparison(date) === formatDateForComparison(today);
  };

  const isSelected = (date: Date) => {
    return selectedDate && formatDateForComparison(date) === formatDateForComparison(selectedDate);
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-white transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToPreviousMonth}
              className="p-2 text-gray-700 hover:bg-white rounded transition-colors"
            >
              ←
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 text-gray-700 hover:bg-white rounded transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
          {/* Day Names Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} className="bg-gray-50">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-gray-700 py-3 border-b-2 border-gray-300"
                style={{ borderRight: index < 6 ? '1px solid #d1d5db' : 'none' }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Weeks */}
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
            >
              {week.map((day, dayIndex) => {
                const hasItems = hasItemsOnDate(day);
                const isCurrentMonthDay = isCurrentMonth(day);
                const isTodayDay = isToday(day);
                const isSelectedDay = isSelected(day);
                const holiday = getHolidayForDate(day);

                return (
                  <button
                    key={dayIndex}
                    onClick={() => onDateClick(day)}
                    className={`
                      relative h-28 p-2 transition-colors text-left
                      ${!isCurrentMonthDay ? 'bg-gray-50' : 'bg-white'}
                      ${isSelectedDay ? 'bg-blue-100 ring-2 ring-inset ring-blue-600' : ''}
                      ${!isSelectedDay && isTodayDay ? 'bg-blue-50' : ''}
                      ${!isSelectedDay ? 'hover:bg-gray-100' : ''}
                    `}
                    style={{
                      borderRight: dayIndex < 6 ? '1px solid #d1d5db' : 'none',
                      borderBottom: weekIndex < weeks.length - 1 ? '1px solid #d1d5db' : 'none'
                    }}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      !isCurrentMonthDay ? 'text-gray-400' :
                      isSelectedDay ? 'text-blue-700 font-bold' :
                      isTodayDay ? 'text-blue-600 font-bold' :
                      'text-gray-900'
                    }`}>
                      {day.getDate()}
                    </div>

                    {holiday && (
                      <div className="text-xs text-gray-900 font-medium mt-1 leading-tight">
                        {holiday}
                      </div>
                    )}

                    {hasItems && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className={`w-full h-1 rounded ${
                          isSelectedDay ? 'bg-blue-600' : 'bg-blue-500'
                        }`} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Game Detail Card Component (for sidebar)
function GameDetailCard({
  game,
  onEdit,
  onDelete,
  onViewFilm
}: {
  game: Game;
  onEdit: (game: Game) => void;
  onDelete: (id: string) => void;
  onViewFilm: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
          GAME
        </span>
        {game.game_result && (
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              game.game_result === 'win'
                ? 'bg-green-100 text-green-700'
                : game.game_result === 'loss'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {game.game_result.toUpperCase()}
          </span>
        )}
      </div>

      <h4 className="text-lg font-semibold text-gray-900 mb-3">
        vs {game.opponent || 'TBD'}
      </h4>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        {game.start_time && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Time:</span>
            <span>{formatTime(game.start_time)}</span>
          </div>
        )}
        {game.location && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Location:</span>
            <span>{game.location}</span>
          </div>
        )}
        {(game.team_score !== null || game.opponent_score !== null) && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Score:</span>
            <span className="text-base font-semibold text-gray-900">
              {game.team_score ?? '-'} - {game.opponent_score ?? '-'}
            </span>
          </div>
        )}
        {game.notes && (
          <div className="mt-2 text-gray-500">
            <p className="text-xs">{game.notes}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <button
          onClick={onViewFilm}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          View/Add Film →
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(game)}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(game.id)}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Event Detail Card Component (for sidebar)
function EventDetailCard({
  event,
  onEdit,
  onDelete
}: {
  event: TeamEvent;
  onEdit: (event: TeamEvent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          event.event_type === 'practice'
            ? 'bg-purple-100 text-purple-700'
            : event.event_type === 'meeting'
            ? 'bg-orange-100 text-orange-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {event.event_type.toUpperCase()}
        </span>
      </div>

      <h4 className="text-lg font-semibold text-gray-900 mb-3">
        {event.title}
      </h4>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        {(event.start_time || event.end_time) && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Time:</span>
            <span>
              {event.start_time && formatTime(event.start_time)}
              {event.start_time && event.end_time && ' - '}
              {event.end_time && formatTime(event.end_time)}
            </span>
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Location:</span>
            <span>{event.location}</span>
          </div>
        )}
        {event.description && (
          <div className="mt-2 text-gray-500">
            <p className="text-xs">{event.description}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
        <button
          onClick={() => onEdit(event)}
          className="text-xs text-gray-600 hover:text-gray-900"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(event.id)}
          className="text-xs text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// Event Modal Component
function EventModal({
  event,
  initialDate,
  onSave,
  onClose
}: {
  event: TeamEvent | null;
  initialDate: string;
  onSave: (data: EventFormData) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<EventFormData>({
    event_type: event?.event_type || 'practice',
    title: event?.title || '',
    description: event?.description || '',
    date: event?.date || initialDate,
    start_time: event?.start_time || '',
    end_time: event?.end_time || '',
    location: event?.location || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          {event ? 'Edit Event' : 'Add Practice/Event'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <select
              value={formData.event_type}
              onChange={(e) => setFormData({ ...formData, event_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            >
              <option value="practice">Practice</option>
              <option value="meeting">Meeting</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Monday Practice, Team Meeting"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Main Field, School Gym"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Additional details..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              {event ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Game Modal Component
function GameModal({
  game,
  initialDate,
  onSave,
  onClose
}: {
  game: Game | null;
  initialDate: string;
  onSave: (data: GameFormData) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<GameFormData>({
    name: game?.name || '',
    opponent: game?.opponent || '',
    date: game?.date || initialDate,
    start_time: game?.start_time || '',
    location: game?.location || '',
    notes: game?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          {game ? 'Edit Game' : 'Add Game'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Game Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Week 1, Homecoming Game"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opponent
            </label>
            <input
              type="text"
              value={formData.opponent}
              onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
              placeholder="Opponent team name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kickoff Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Home Field, Opponent Stadium"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional game notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              {game ? 'Save Changes' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper functions
function formatDateForComparison(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(timeString: string): string {
  if (!timeString) return '';

  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
}
