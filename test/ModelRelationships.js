const config = {
  client: 'sqlite3',
  connection: {
    filename: ':memory:'
  },
  useNullAsDefault: true
};

const knex = require('knex')(config);
const { Model, Schema } = require('../src/');
const { expect } = require('chai');

describe('Single Relationships', () => {
  let parentSchema = new Schema({
    name: {
      type: Schema.Types.String,
      required: true
    },
    children: {
      type: Schema.Types.Models,
      relatedModel: 'Child'
    }
  });

  let childSchema = new Schema({
    name: {
      type: Schema.Types.String,
      required: true
    },
    parent: {
      type: Schema.Types.Model,
      relatedModel: 'Parent'
    }
  });

  class Parent extends Model(parentSchema) {
    static get knex() {
      return knex;
    }
  }

  class Child extends Model(childSchema) {
    static get knex() {
      return knex;
    }
  }

  const registry = {};

  Parent.attachToRegistry(registry);
  Child.attachToRegistry(registry);

  it ('should have attached to the registry properly', () => {
    expect(Parent.registry).to.equal(registry);
    expect(Child.registry).to.equal(registry);
  });

  before(async () => {
    await Promise.all([
      knex.schema.createTable('Parent', table => {
        table.increments('id');
      }),
      knex.schema.createTable('Child', table => {
        table.increments('id');
        table.integer('parentId');
      })
    ]);

    await Promise.all([
      knex('Parent').insert([{
        id: 1
      }, {
        id: 2
      }]),
      knex('Child').insert([{
        id: 1,
        parentId: 1
      }, {
        id: 2,
        parentId: 1
      }, {
        id: 3,
        parentId: 2
      }, {
        id: 4,
        parentId: 2
      }])
    ]);
  });

  describe('as a parent', async () => {
    let parent;

    before(async () => {
      parent = await Parent.findById(1, {
        withRelated: ['children']
      });
    });

    it('should be able to fetch with child records', () => {
      expect(parent.children).to.be.instanceOf(Array);
      expect(parent.children.length).to.equal(2);
    });

    it('should serialize child records', () => {
      expect(parent.toJSON().children).to.eql([{
        id: 1,
        parentId: 1
      }, {
        id: 2,
        parentId: 1
      }]);
    });

    it('should be able to attach the relationship to both sides', () => {
      parent.children.forEach(child => {
        expect(child).to.be.an.instanceof(Child);
        expect(child.parent).to.equal(parent);
      });
    });
  });


  describe('as a child', () => {
    let children;
    before(async () => {
      children = await Child.find({parentId: 1}, {
        withRelated: ['parent']
      });
    });

    it('should serialize child records', () => {
      expect(children[0].toJSON().parent).to.eql({
        id: 1,
        children: [{
          id: 2,
          parentId: 1
        }]
      });
    });

    it('should be able to fetch with the parent record', () => {
      expect(children.length).to.equal(2);

      let [child, child2] = children;

      expect(child.parent).to.be.an.instanceof(Parent);
      expect(child.parentId).to.equal(child.parent.id);
      
      expect(child.parent.children).to.contain(child);
      expect(child.parent.children).to.contain(child2);
      expect(child.parent).to.equal(child2.parent);
    });
  });

  after(async () => {
    await Promise.all([
      knex.schema.dropTable('Parent'),
      knex.schema.dropTable('Child')
    ]);
  });
});

describe('Join Relationships', () => {
  const courseSchema = new Schema({
    students: {
      type: Schema.Types.Models,
      relatedModel: 'Student',
      through: 'StudentCourse'
    }
  });

  class Course extends Model(courseSchema) {
    static get knex() {
      return knex;
    }
  }

  const studentSchema = new Schema({
    courses: {
      type: Schema.Types.Models,
      relatedModel: 'Course',
      through: 'StudentCourse'
    }
  });

  class Student extends Model(studentSchema) {
    static get knex() {
      return knex;
    }
  }

  const registry = {};

  Course.attachToRegistry(registry);
  Student.attachToRegistry(registry);
  let students;
  let courses;

  before(async () => {
    await Promise.all([
      knex.schema.createTable('Student', table => {
        table.increments('id');
      }),
      knex.schema.createTable('Course', table => {
        table.increments('id');
      }),
      knex.schema.createTable('StudentCourse', table => {
        table.integer('studentId');
        table.integer('courseId');
      })
    ]);
    await Promise.all([
      knex('Student').insert([{
        id: 1
      }, {
        id: 2
      }, {
        id: 3
      }]),
      knex('Course').insert([{
        id: 1
      }, {
        id: 2
      }, {
        id: 3
      }]),
      knex('StudentCourse').insert([{
        studentId: 1,
        courseId: 1
      }, {
        studentId: 1,
        courseId: 2
      }, {
        studentId: 2,
        courseId: 1
      }])
    ]);
    students = await Student.find(q => q.orderBy('id'), {
      withRelated: ['courses']
    });
    courses = await Course.find(q => q.orderBy('id'), {
      withRelated: ['students']
    });
  });

  it('should have retrieved the correct amount of joined rows', () => {
    expect(students[0].courses.length).to.equal(2);
    expect(students[1].courses.length).to.equal(1);
    expect(students[2].courses.length).to.equal(0);
  });


  it('should have retrieved the correct amount of joined rows', () => {
    expect(courses[0].students.length).to.equal(2);
    expect(courses[1].students.length).to.equal(1);
    expect(courses[2].students.length).to.equal(0);
  });

  after(async () => {
    await Promise.all([
      knex.schema.dropTable('Student'),
      knex.schema.dropTable('Course'),      
      knex.schema.dropTable('StudentCourse')
    ]);
  });
});

describe('Deep Relationships', () => {
  const principalSchema = new Schema({
    teachers: {
      type: Schema.Types.Models,
      relatedModel: 'Teacher'
    }
  });
  class Principal extends Model(principalSchema) {
    static get knex() {
      return knex;
    }
  }

  const teacherSchema = new Schema({
    principal: {
      type: Schema.Types.Model,
      relatedModel: 'Principal'
    },
    students: {
      type: Schema.Types.Models,
      relatedModel: 'Student'
    }
  });
  class Teacher extends Model(teacherSchema) {
    static get knex() {
      return knex;
    }
  }

  const studentSchema = new Schema({
    teacher: {
      type: Schema.Types.Model,
      relatedModel: 'Teacher'
    }
  });
  class Student extends Model(studentSchema) {
    static get knex() {
      return knex;
    }
  }

  const registry = {};
  Principal.attachToRegistry(registry);
  Teacher.attachToRegistry(registry);
  Student.attachToRegistry(registry);
  let principal;
  let student;
  before(async () => {
    await Promise.all([
      knex.schema.createTable('Principal', table => table.increments('id')),
      knex.schema.createTable('Teacher', table => {
        table.increments('id');
        table.integer('principalId');
      }),
      knex.schema.createTable('Student', table => {
        table.increments('id');
        table.integer('teacherId');
      })
    ]);

    await Promise.all([
      knex('Principal').insert([{
        id: 1
      }]),
      knex('Teacher').insert([{
        id: 1,
        principalId: 1
      }, {
        id: 2,
        principalId: 1
      }]),
      knex('Student').insert([{
        id: 1,
        teacherId: 1
      }, {
        id: 2,
        teacherId: 1
      }, {
        id: 3,
        teacherId: 2
      }, {
        id: 4,
        teacherId: 2
      }])
    ]);

    principal = await Principal.findById(1, {
      withRelated: ['teachers.students']
    });

    student = await Student.findById(1, {
      withRelated: ['teacher.principal']
    });
  });

  describe('from the top', () => {
    it('should have retrieved one layer deep', () => {
      principal.teachers.forEach(teacher => {
        expect(teacher).to.be.an.instanceOf(Teacher);
        expect(teacher.students.length).to.equal(2);
        expect(teacher.principal).to.equal(principal);
      });
    });

    it('should have retrieved two layers deep', () => {
      principal.teachers.forEach(teacher => {
        expect(teacher.students.length).to.equal(2);
        teacher.students.forEach(student => {
          expect(student).to.be.an.instanceOf(Student);
          expect(student.teacherId).to.equal(student.teacher.id);
          expect(student.teacherId).to.equal(teacher.id);
          expect(student.teacher.principal).to.equal(principal);
        });
      });
    });
  });

  describe('from the bottom', () => {
    it('should have retrieved one layer up', () => {
      expect(student.teacher).to.be.an.instanceOf(Teacher);
      expect(student.teacherId).to.equal(student.teacher.id);
    });

    it('should have retrieved two layers up', () => {
      expect(student.teacher.principal).to.be.an.instanceOf(Principal);
      expect(student.teacher.principalId).to.equal(student.teacher.principal.id);
      expect(student.teacher.principalId).to.equal(principal.id);
    });
  });


  after(async () => {
    await Promise.all([
      knex.schema.dropTable('Principal'),
      knex.schema.dropTable('Teacher'),
      knex.schema.dropTable('Student')
    ]);
  });
});

describe('Multiple Relationships', () => {
  let parentSchema = new Schema({
    name: {
      type: Schema.Types.String
    },
    fatheredChildren: {
      type: Schema.Types.Models,
      relatedModel: 'Child',
      foreignField: 'fatherId'
    },
    motheredChildren: {
      type: Schema.Types.Models,
      relatedModel: 'Child',
      foreignField: 'motherId'
    }
  });

  let childSchema = new Schema({
    father: {
      type: Schema.Types.Model,
      relatedModel: 'Parent',
      localField: 'fatherId'
    },
    mother: {
      type: Schema.Types.Model,
      relatedModel: 'Parent',
      localField: 'motherId'
    }
  });

  let registry;

  class Parent extends Model(parentSchema) {
    static get knex() {
      return knex;
    }

    static get registry() {
      return registry;
    }
  }

  class Child extends Model(childSchema) {
    static get knex() {
      return knex;
    }

    static get registry() {
      return registry;
    }
  }

  registry = {
    Parent,
    Child
  };


  before(async () => {
    await Promise.all([
      knex.schema.createTable('Parent', table => {
        table.increments('id');
      }),
      knex.schema.createTable('Child', table => {
        table.increments('id');
        table.integer('motherId');
        table.integer('fatherId');
      })
    ]);

    await Promise.all([
      knex('Parent').insert([{
        id: 1
      }, {
        id: 2
      }]),
      knex('Child').insert([{
        id: 1,
        motherId: 1,
        fatherId: 2
      }, {
        id: 2,
        motherId: 1,
        fatherId: 2
      }])
    ]);
  });

  describe('as a child', () => {
    let children;
    before(async () => {
      children = await Child.find({}, {
        withRelated: ['father', 'mother']
      });
    });

    it('should have retrieved both parents', () => {
      expect(children.length).to.equal(2);
      
      let [child1, child2] = children;

      expect(child1.mother).to.be.an.instanceof(Parent);
      expect(child1.motherId).to.equal(child1.mother.id);
      expect(child1.mother).to.equal(child2.mother);

      expect(child1.father).to.be.an.instanceof(Parent);
      expect(child1.fatherId).to.equal(child1.father.id);
      expect(child1.father).to.equal(child2.father);
    });
  });

  after(async () => {
    await Promise.all([
      knex.schema.dropTable('Parent'),
      knex.schema.dropTable('Child')
    ]);
  });
});