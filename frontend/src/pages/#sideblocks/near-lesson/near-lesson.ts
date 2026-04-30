import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MinutesToReadablePipe } from "@pipes/minutes-to-readable.pipe";
import { TruncatePipe } from "@pipes/truncate.pipe";

@Component({
  selector: 'near-lesson',
  imports: [CommonModule, RouterModule,
    MatIconModule, MatButtonModule, MinutesToReadablePipe, TruncatePipe],
  templateUrl: './near-lesson.html',
  styleUrl: './near-lesson.scss',
})
export class NearLesson implements OnInit {
  @Output() hasLessonChange = new EventEmitter<boolean>();
  public lesson: any | null = null;
  constructor(
    public auth: AuthService,
    public dataService: DataService,
    private cdr: ChangeDetectorRef
  ) {
  }
  ngOnInit(): void {
    const token = this.auth.tokenValue;
    if (!token) {
      this.hasLessonChange.emit(false);
      this.cdr.detectChanges();
      return;
    }
    this.dataService.lessonsDS.getNearest(token).subscribe({
      next: (response) => {
        this.lesson = response.lesson;
        this.hasLessonChange.emit(!!this.lesson);
        this.cdr.detectChanges();
      },
      error: () => {
        this.lesson = null;
        this.hasLessonChange.emit(false);
        this.cdr.detectChanges();
      }
    });
  }
}
