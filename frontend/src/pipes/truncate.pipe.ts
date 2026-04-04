import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true
})
export class TruncatePipe implements PipeTransform {
  transform(
    value: string, 
    limit: number,
  ): string {
    if (!value) return '';
    if (limit==-1) return value;
    const letterLimit = limit !== undefined ? limit : 100;
    let textToTruncate = value;
    if (textToTruncate.length <= letterLimit) {
      return value;
    }
    let truncated = textToTruncate.substring(0, letterLimit);
    return truncated + '...';
  }
}