import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'roleName', standalone: true })
export class RoleNamePipe implements PipeTransform {
  transform(text: string): string {
    if (text=='creator') return 'Создатель';
      else if (text=='teacher') return 'Учитель';
      else if (text=='student') return 'Ученик';
    return '';
    }
  }