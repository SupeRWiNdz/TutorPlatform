import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'minutesToReadable',
  pure: true
})
export class MinutesToReadablePipe implements PipeTransform {

  transform(value: any): string | null {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return null;
    }
    if (!Number.isInteger(value) || value < 0) {
      return null;
    }

    const minutes = value as number;

    if (minutes === 0) {
      return null;
    }

    const MINUTES_IN_DAY = 1440;
    const MINUTES_IN_WEEK = 10080;

    if (minutes > MINUTES_IN_WEEK) {
      return null;
    }

    if (minutes >= MINUTES_IN_DAY) {
      const days = Math.floor(minutes / MINUTES_IN_DAY);
      return `${days} ${this.pluralize(days, 'день', 'дня', 'дней')}`;
    }

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return `${hours} ${this.pluralize(hours, 'час', 'часа', 'часов')}`;
    }

    if (minutes >= 1) {
      return `${minutes} ${this.pluralize(minutes, 'минута', 'минуты', 'минут')}`;
    }

    return null;
  }

  private pluralize(n: number, form1: string, form2: string, form5: string): string {
    const lastDigit = n % 10;
    const lastTwoDigits = n % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return form5;
    }
    if (lastDigit === 1) {
      return form1;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return form2;
    }
    return form5;
  }
}