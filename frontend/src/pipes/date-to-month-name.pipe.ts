import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateToMonthName'
})
export class DateToMonthNamePipe implements PipeTransform {

  private readonly monthNames: { [key: string]: string } = {
    '01': 'января',
    '02': 'февраля',
    '03': 'марта',
    '04': 'апреля',
    '05': 'мая',
    '06': 'июня',
    '07': 'июля',
    '08': 'августа',
    '09': 'сентября',
    '10': 'октября',
    '11': 'ноября',
    '12': 'декабря'
  };

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const parts = value.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid date format. Expected DD.MM.YYYY');
      return value;
    }

    const day = parts[0];
    const month = parts[1];

    if (!this.isValidDay(day) || !this.isValidMonth(month)) {
      console.warn('Invalid day or month');
      return value;
    }

    const monthName = this.monthNames[month];
    if (!monthName) {
      return value;
    }

    const formattedDay = day.startsWith('0') ? day.substring(1) : day;

    return `${formattedDay} ${monthName}`;
  }

  private isValidDay(day: string): boolean {
    const dayNum = parseInt(day, 10);
    return !isNaN(dayNum) && dayNum >= 1 && dayNum <= 31;
  }

  private isValidMonth(month: string): boolean {
    const monthNum = parseInt(month, 10);
    return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12;
  }
}