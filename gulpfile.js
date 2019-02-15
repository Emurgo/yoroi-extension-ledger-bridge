'use strict'
require('dotenv').config()

const gulp = require('gulp')
const babel = require('gulp-babel')
const eslint = require('gulp-eslint')
const flow = require('gulp-flowtype')

const sources = ['src/*.js']

gulp.task('lint', () => {
  return gulp.src(sources)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
})

gulp.task('flow', () => {
  return gulp.src(sources)
    .pipe(flow({
      all: false,
      weak: false,
      declarations: './types',
      killFlow: false,
      beep: true,
      abort: false
    }))
})

gulp.task('babel', function () {
  return gulp.src(sources)
    .pipe(babel())
    .pipe(gulp.dest('dist'))
})

gulp.task('check', ['lint', 'flow'])

gulp.task('build', ['check', 'babel'])

gulp.task('default', [ 'build' ])
