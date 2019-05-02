import Vue from 'vue';
import Router from 'vue-router';
import Study from '@/components/Study';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/studies/:id',
      name: 'Study viewer',
      component: Study,
    },
  ],
  mode: 'history',
});
