import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

export type DatePreset = 'today' | 'week' | 'month' | 'custom' | 'all';

interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onDateChange: (start: Date | undefined, end: Date | undefined) => void;
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
}

export function getDefaultWeekRange() {
  const now = new Date();
  return {
    start: subDays(now, 7),
    end: now,
  };
}

export default function DateRangeFilter({
  startDate,
  endDate,
  onDateChange,
  preset,
  onPresetChange,
}: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  function handlePresetChange(value: DatePreset) {
    onPresetChange(value);
    const now = new Date();

    switch (value) {
      case 'today':
        onDateChange(now, now);
        break;
      case 'week':
        onDateChange(subDays(now, 7), now);
        break;
      case 'month':
        onDateChange(startOfMonth(now), endOfMonth(now));
        break;
      case 'all':
        onDateChange(undefined, undefined);
        break;
      case 'custom':
        // Keep current dates for custom
        break;
    }
  }

  function handleClear() {
    onPresetChange('all');
    onDateChange(undefined, undefined);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">Last 7 Days</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
          <SelectItem value="all">All Time</SelectItem>
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'justify-start text-left font-normal min-w-[200px]',
                  !startDate && !endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate && endDate ? (
                  <>
                    {format(startDate, 'dd MMM')} - {format(endDate, 'dd MMM yyyy')}
                  </>
                ) : (
                  <span>Pick date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: startDate, to: endDate }}
                onSelect={(range) => {
                  onDateChange(range?.from, range?.to);
                  if (range?.from && range?.to) {
                    setCalendarOpen(false);
                  }
                }}
                initialFocus
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {(startDate || endDate) && preset !== 'all' && (
        <Button variant="ghost" size="icon" onClick={handleClear} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      )}

      {preset !== 'all' && preset !== 'custom' && startDate && endDate && (
        <span className="text-sm text-muted-foreground">
          {format(startDate, 'dd MMM')} - {format(endDate, 'dd MMM yyyy')}
        </span>
      )}
    </div>
  );
}
