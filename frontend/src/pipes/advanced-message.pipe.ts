import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'advancedFormatMessage', standalone: true })
export class AdvancedFormatMessagePipe implements PipeTransform {
  transform(text: string): string {
    if (!text) return text;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return text.replace(urlRegex, (url) => {
      let cleanUrl = url;
      
      const attributeMatch = cleanUrl.match(/^(https?:\/\/[^\s"'>]+)/);
      if (attributeMatch) {
        cleanUrl = attributeMatch[1];
      }
      
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
    });
  }
}