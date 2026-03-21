import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'advancedFormatMessage',
  standalone: true
})
export class AdvancedFormatMessagePipe implements PipeTransform {
  transform(text: string): string {
    if (!text) return text;
    
    let formattedText = text;
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formattedText = formattedText.replace(urlRegex, (url) => {
      const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${displayUrl}</a>`;
    });
    
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    formattedText = formattedText.replace(emailRegex, (email) => {
      return `<a href="mailto:${email}" class="message-email">${email}</a>`;
    });
    
    const phoneRegex = /(\+?[\d\s-]{10,})/g;
    formattedText = formattedText.replace(phoneRegex, (phone) => {
      return `<a href="tel:${phone.replace(/\s/g, '')}" class="message-phone">${phone}</a>`;
    });
    
    return formattedText;
  }
}