import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RoleIconPipe } from '../../services/role-icon.pipe';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-class-list',
  imports: [CommonModule, ReactiveFormsModule, RoleIconPipe,
    MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './class-list.html',
  styleUrl: './class-list.css',
})

export class ClassList implements OnInit {
  classes$: Observable<any>;
  private _isCreating: boolean = false;
  public get isCreating(): boolean {
  return this._isCreating;
  }
  public createClassForm: FormGroup;

  constructor(
    private dataService: DataService,
    private authService: AuthService,
    private router: Router
  ) {
    this.classes$ = new Observable<any>
    this.createClassForm = new FormGroup({
    name: new FormControl('', [Validators.minLength(1), Validators.maxLength(100)]),
    description: new FormControl('', [Validators.maxLength(1000)]),
    link: new FormControl('', [Validators.pattern(/^[a-zA-Z-]+$/), Validators.minLength(3), Validators.maxLength(20)])
    });
  }

  ngOnInit() {
    const sessionId = this.authService.tokenValue;

    if (!sessionId) {
      return;
    }

    this.classes$ = this.dataService.classDS.myClasses(sessionId);
  }

  navigateToClass(link: string) {
    this.router.navigate(['/class', link]);
  }
  
  trackByClass(index: number, classItem: any): string {
    return classItem.link;
  }

  public createMode(): void {
    this._isCreating=true;
  }
  public exitCreateMode(): void {
    this._isCreating=false;
    this.createClassForm.reset();
  }
  public createClass(): void {
    const { tokenValue: sessionId } = this.authService;
    if (!sessionId || !this.createClassForm.valid) return;
    const { name, link, description } = this.createClassForm.value;
    this.dataService.classDS.createClass(sessionId, name, link, description)
      .subscribe(({ class: { link } }) => {
        if (link) this.router.navigate(['/class', link]);
      });
  }
}