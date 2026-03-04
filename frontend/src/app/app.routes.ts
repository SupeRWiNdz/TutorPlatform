import { Routes } from '@angular/router';
import { NotExist } from '../pages/not-exist/not-exist';
import { Account } from '../pages/account/account';
import { LoginComponent } from '../pages/login/login';
import { Profile } from '../pages/profile/profile';
import { Chat } from '../pages/chat/chat';
import { UserResolver } from '../services/user.resolver';
import { AuthGuard } from '../services/auth.guard';
import { ProfileResolver } from '../services/profile.resolver';

export const routes: Routes = [
  { 
    path: '', 
    resolve: { user: UserResolver },
    children: [
      {
        path: '',
        redirectTo: '/login', 
        pathMatch: 'full' 
      },
      {
        path: 'login', 
        component: LoginComponent,
        title: 'Войти в аккаунт'
      },
      { 
        path: 'account', 
        component: Account,
        canActivate: [AuthGuard],
        title: 'Настройки аккаунта'
      },
      {
        path: 'profile/:username',
        component: Profile,
        resolve: { profile: ProfileResolver },
        title: 'Профиль'
      },
      {
        path: 'chat/:username',
        component: Chat,
        canActivate: [AuthGuard],
        resolve: { profile: ProfileResolver },
        title: 'Чат'
      },
      {
        path: '**',
        component: NotExist,
        title: 'Ошибка 404'
      }
    ]
  }
];
