import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'roleIcon', standalone: true })
export class RoleIconPipe implements PipeTransform {
  transform(text: string): string {
    if (text=='creator') return 'diamond';
      else if (text=='teacher') return 'self_improvement';
      else if (text=='student') return 'man';
    return '';
    }
  }