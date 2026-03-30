import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'dateToday', standalone: true })
export class DateTodayPipe implements PipeTransform {
  transform(date: string | Date): string {
    if (!date) return '';
    
    const today = new Date();
    const messageDate = new Date(date);
    
    const isToday = messageDate.getDate() === today.getDate() &&
                    messageDate.getMonth() === today.getMonth() &&
                    messageDate.getFullYear() === today.getFullYear();
    
    if (isToday) {
      const hours = messageDate.getHours().toString().padStart(2, '0');
      const minutes = messageDate.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else {
      const day = messageDate.getDate().toString().padStart(2, '0');
      const month = (messageDate.getMonth() + 1).toString().padStart(2, '0');
      const hours = messageDate.getHours().toString().padStart(2, '0');
      const minutes = messageDate.getMinutes().toString().padStart(2, '0');
      return `${day}.${month} ${hours}:${minutes}`;
    }
  }
}