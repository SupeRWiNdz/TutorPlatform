import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-class-list',
  imports: [CommonModule],
  templateUrl: './class-list.html',
  styleUrl: './class-list.css',
})

export class ClassList implements OnInit {
  classes$: Observable<any>;

  constructor(
    private dataService: DataService,
    private authService: AuthService,
    private router: Router
  ) {
    this.classes$ = new Observable<any>
  }

  ngOnInit() {
    const sessionId = this.authService.tokenValue;

    if (!sessionId) {
      return;
    }

    this.classes$ = this.dataService.classDS.getClasses(sessionId);
  }

  navigateToClass(link: string) {
    this.router.navigate(['/class', link]);
  }
  
  trackByClass(index: number, classItem: any): string {
    return classItem.link;
  }
}