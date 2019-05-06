import Vue from 'vue';
import Router from 'vue-router';
import Study from '@/components/Study';
// import Image from '@/components/Image';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/studies/:id',
      name: 'Study viewer',
      component: Study,
    },
    // {
    //   path: '/images/:id',
    //   name: 'Image viewer',
    //   component: Image,
    // },
  ],
  mode: 'history',
});
