import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { dailyFixHref, dateFromIso, FIRST_FIX_ISO, isoFromDate, type Pillar } from "./model";

type DatePickerDialogProps = {
  todayIso: string;
  panelIso: string;
  pillar: Pillar | null;
};

export function DatePickerDialog({ todayIso, panelIso, pillar }: DatePickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const first = dateFromIso(FIRST_FIX_ISO);
  const today = dateFromIso(todayIso);
  const selected = dateFromIso(panelIso);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="df-chip df-chip-calendar" aria-label="Choose a date">
          <span className="df-chip-dow" aria-hidden="true">
            Date
          </span>
          <CalendarDays className="df-chip-calendar-icon" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="df-calendar-dialog">
        <DialogTitle className="df-calendar-title">Choose a day</DialogTitle>
        <DialogDescription className="df-calendar-description">
          Every Daily Fix since February 10, 2025.
        </DialogDescription>
        <Calendar
          mode="single"
          required
          selected={selected}
          defaultMonth={selected}
          today={today}
          startMonth={first}
          endMonth={today}
          disabled={[{ before: first }, { after: today }]}
          captionLayout="dropdown"
          showOutsideDays={false}
          className="df-calendar"
          onSelect={(date) => {
            setOpen(false);
            navigate(dailyFixHref(todayIso, isoFromDate(date), pillar));
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
