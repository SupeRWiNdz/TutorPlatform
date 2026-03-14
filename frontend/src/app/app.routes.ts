import { Routes } from '@angular/router';
import { NotExist } from '../pages/not-exist/not-exist';
import { Account } from '../pages/account/account';
import { LoginComponent } from '../pages/login/login';
import { Profile } from '../pages/profile/profile';
import { Chat } from '../pages/chat/chat';
import { AuthGuard } from '../services/auth.guard';
import { Main } from '../pages/main/main';
import { ChatList } from '../pages/chat-list/chat-list';
import { ClassList } from '../pages/class-list/class-list';
import { Class } from '../pages/class/class';
import { CreateClass } from '../pages/create-class/create-class';
import { UserResolver } from '../resolvers/user.resolver';
import { ProfileResolver } from '../resolvers/profile.resolver';
import { ClassResolver } from '../resolvers/class.resolver';
import { OwnProfileRedirectGuard } from '../services/own-profile-redirect.guard';
import { AccountResolver } from '../resolvers/account.resolver';

export const routes: Routes = [
  { 
    path: '', 
    resolve: { user: UserResolver },
    children: [
      {
        path: '',
        component: Main,
        title: 'Главная'
      },
      {
        path: 'chat',
        component: ChatList,
        canActivate: [AuthGuard],
        title: 'Список чатов'
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
        resolve: {account: AccountResolver},
        title: 'Настройки аккаунта'
      },
      {
        path: 'profile/:username',
        component: Profile,
        canActivate: [OwnProfileRedirectGuard],
        resolve: { profile: ProfileResolver }
      },
      {
        path: 'chat/:username',
        component: Chat,
        canActivate: [AuthGuard],
        resolve: { profile: ProfileResolver }
      },
      {
        path: 'class',
        component: ClassList,
        canActivate: [AuthGuard],
        title: 'Список классов'
      },
      {
        path: 'new-class',
        component: CreateClass,
        canActivate: [AuthGuard],
        title: 'Создать класс'
      },
      {
        path: 'class/:link',
        component: Class,
        resolve: { class: ClassResolver },
        canActivate: [AuthGuard]
      },
      {
        path: '**',
        component: NotExist,
        title: 'Ошибка 404'
      }
    ]
  }
];
