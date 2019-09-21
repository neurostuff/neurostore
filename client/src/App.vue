<template>
  <div id="app">
    <div>
      <b-navbar toggleable="md" type="dark" variant="dark" id="navbar">
        <b-navbar-brand href="#">NeuroStuff</b-navbar-brand>
        <b-navbar-nav>
          <b-nav-item href="/studies">Studies</b-nav-item>
          <b-nav-item href="/faqs">FAQs</b-nav-item>
        </b-navbar-nav>
      </b-navbar>
    </div>
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'App',
};
</script>

<style>
#navbar {
  margin-bottom: 20px;
}
</style>
