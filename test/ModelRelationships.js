const config = {
  client: 'sqlite3',
  connection: {
    filename: ':memory:'
  },
  useNullAsDefault: true
};

const { Model, Schema, Registry } = require('../src/');
const { expect } = require('chai');

describe('Single Relationships', () => {
  let parentSchema = new Schema({
    name: {
      type: Schema.Types.String,
      required: true
    },
    children: {
      type: Schema.Types.Models,
    }
  });

  let childSchema = new Schema({
    name: {
      type: Schema.Types.String,
      required: true
    },
    parent: {
      type: Schema.Types.Model,
    }
  });

  class Parent extends Model(parentSchema) { }

  class Child extends Model(childSchema) { }

  const registry = new Registry(Object.assign({
    models: [
      Parent,
      Child
    ]
  }, config));

  const knex = registry._knex;

  before(async () => {
    await Promise.all([
      knex.schema.createTable('Parents', table => {
        table.increments('id');
      }),
      knex.schema.createTable('Children', table => {
        table.increments('id');
        table.integer('parentId');
      })
    ]);
    
    await Promise.all([
      knex('Parents').insert([{
        id: 1
      }, {
        id: 2
      }, {
        id: 3
      }]),
      knex('Children').insert([{
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

  it ('should have attached to the registry properly', () => {
    expect(Parent.registry).to.equal(registry);
    expect(Child.registry).to.equal(registry);
  });
  
  describe('as a parent', async () => {
    let parent;
    
    before(async () => {
      parent = await Parent.findById(1, {
        withRelated: ['children']
      });
    });

    it('should handle invalid "withRelated" attributes', async () => {
      let err;
      try {
        await Parent.findById(1, {
          withRelated: ['non-existent']
        });
      } catch(e) {
        err = e;
      }

      expect(err.message).to.contain('No such attribute');
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

    it('should be able to manually pull the records', async () => {
      let result = await parent.pullRelated('children');

      expect(result.length).to.equal(2);
      expect(parent.children).to.equal(result);
    });

    it('should handle records with no related records', async () => {
      let yuppy = await Parent.findById(3, {
        withRelated: ['children']
      });

      expect(yuppy).to.an.instanceOf(Parent);
      expect(yuppy.children).to.eql([]);
    });

    it('should handle records with no related records', async () => {
      let empty = await Parent.find({id: 4}, {
        withRelated: ['children']
      });

      expect(empty).to.eql([]);
    });

    it('should be able to manually pull the records', async () => {
      let err;
      try {
        await parent.pullRelated('otherChildren');
      } catch(e) {
        err = e;
      }
      expect(err.message).to.contain('No such relationship');
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
      knex.schema.dropTable('Parents'),
      knex.schema.dropTable('Children')
    ]);
  });
});

describe('Join Relationships', () => {
  const courseSchema = new Schema({
    students: {
      type: Schema.Types.Models,
      through: 'StudentCourses'
    }
  });

  class Course extends Model(courseSchema) { }

  const studentSchema = new Schema({
    courses: {
      type: Schema.Types.Models,
      through: 'StudentCourses'
    }
  });

  class Student extends Model(studentSchema) { }

  const registry = new Registry(Object.assign({
    models: [
      Student,
      Course
    ]
  }, config));

  let knex = registry._knex;
  let students, courses;

  before(async () => {
    await Promise.all([
      knex.schema.createTable('Students', table => {
        table.increments('id');
      }),
      knex.schema.createTable('Courses', table => {
        table.increments('id');
      }),
      knex.schema.createTable('StudentCourses', table => {
        table.integer('studentId');
        table.integer('courseId');
      })
    ]);
    await Promise.all([
      knex('Students').insert([{
        id: 1
      }, {
        id: 2
      }, {
        id: 3
      }]),
      knex('Courses').insert([{
        id: 1
      }, {
        id: 2
      }, {
        id: 3
      }]),
      knex('StudentCourses').insert([{
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
      knex.schema.dropTable('Students'),
      knex.schema.dropTable('Courses'),      
      knex.schema.dropTable('StudentCourses')
    ]);
  });
});

describe('Deep Relationships', () => {
  const principalSchema = new Schema({
    teachers: {
      type: Schema.Types.Models,
    }
  });
  class Principal extends Model(principalSchema) { }

  const teacherSchema = new Schema({
    principal: {
      type: Schema.Types.Model,
    },
    students: {
      type: Schema.Types.Models,
    }
  });
  class Teacher extends Model(teacherSchema) { }

  const studentSchema = new Schema({
    teacher: {
      type: Schema.Types.Model,
    }
  });
  class Student extends Model(studentSchema) { }

  const registry = new Registry(Object.assign({
    models: [
      Student,
      Teacher,
      Principal
    ]
  }, config));
  
  let knex = registry._knex;

  let principal;
  let student;
  before(async () => {
    await Promise.all([
      knex.schema.createTable('Principals', table => table.increments('id')),
      knex.schema.createTable('Teachers', table => {
        table.increments('id');
        table.integer('principalId');
      }),
      knex.schema.createTable('Students', table => {
        table.increments('id');
        table.integer('teacherId');
      })
    ]);

    await Promise.all([
      knex('Principals').insert([{
        id: 1
      }]),
      knex('Teachers').insert([{
        id: 1,
        principalId: 1
      }, {
        id: 2,
        principalId: 1
      }]),
      knex('Students').insert([{
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
      knex.schema.dropTable('Principals'),
      knex.schema.dropTable('Teachers'),
      knex.schema.dropTable('Students')
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
    },
    school: {
      type: Schema.Types.Model
    }
  });

  let schoolSchema = new Schema({
    children: {
      type: Schema.Types.Models
    }
  });

  class Parent extends Model(parentSchema) { }

  class Child extends Model(childSchema) { }

  class School extends Model(schoolSchema) { }

  let registry = new Registry(Object.assign({
    models: [
      Parent,
      Child,
      School
    ]
  }, config));

  let knex = registry._knex;

  before(async () => {
    await Promise.all([
      knex.schema.createTable('Parents', table => {
        table.increments('id');
      }),
      knex.schema.createTable('Children', table => {
        table.increments('id');
        table.integer('motherId');
        table.integer('fatherId');
        table.integer('schoolId');
      }),
      knex.schema.createTable('Schools', table => table.increments('id'))
    ]);

    await Promise.all([
      knex('Parents').insert([{
        id: 1
      }, {
        id: 2
      }]),
      knex('Children').insert([{
        id: 1,
        motherId: 1,
        fatherId: 2,
        schoolId: 1
      }, {
        id: 2,
        motherId: 1,
        fatherId: 2,
        schoolId: 1
      }]),
      knex('Schools').insert([{
        id: 1
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

  describe('as a parent', () => {
    let father, mother;
    before(async () => {
      father = await Parent.findById(2, {
        withRelated: ['fatheredChildren.school']
      });
      mother = await Parent.findById(1, {
        withRelated: ['motheredChildren.father']
      });
    });

    it('should have pulled in the school', () => {
      expect(father.fatheredChildren[0].school.id).to.equal(1);
    });

    it('should have pulled in the father from the mother call', () => {
      expect(mother.motheredChildren[0].father.id).to.equal(2);
    });
  });

  describe('as a parent of a parent', () => {
    let school;
    before(async () => {
      school = await School.findById(1, {
        withRelated: ['children.mother', 'children.father']
      });
    });

    it('should have pulled in a child\'s mother and father', () => {
      expect(school.children[0].mother).to.be.an.instanceof(Parent);
      expect(school.children[0].father).to.be.an.instanceof(Parent);
      expect(school.children[0].father.fatheredChildren[0]).to.equal(school.children[0].mother.motheredChildren[0]);
    });
  });

  after(async () => {
    await Promise.all([
      knex.schema.dropTable('Parents'),
      knex.schema.dropTable('Children'),
      knex.schema.dropTable('Schools')
    ]);
  });
});