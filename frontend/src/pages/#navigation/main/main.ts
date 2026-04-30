import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';

@Component({
  selector: 'app-main',
  imports: [],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main implements OnInit {
  public get isStudent(): boolean { return this._isStudent }
  public get isTeacher(): boolean { return this._isTeacher }
  private _isStudent: boolean = false;
  private _isTeacher: boolean = false;

  constructor(
    public auth: AuthService,
    public dataService: DataService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    const token = this.auth.tokenValue;
    if (token) {
      this.dataService.userDS.getUserData(token).subscribe({
        next: (response) => {
          if (response.is_teacher) this._isTeacher = true;
          if (response.is_student) this._isStudent = true;
          this.cdr.detectChanges();
        },
        error: () => {
        }
      });
    }

  }
}
